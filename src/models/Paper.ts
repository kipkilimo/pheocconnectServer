// models/Paper.ts
import mongoose, { Schema, Document } from "mongoose";

// ============================================
// ENUMS
// ============================================

export enum PaperRegistrationStatusEnum {
  PENDING = "PENDING",
  WAITING = "WAITING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum PaperStatusEnum {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
}

// ============================================
// INTERFACES
// ============================================

export interface IPaperRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IPaperAuthorInfo {
  id: string;
  name: string;
  emailAddress: string;
}

export interface IPaperReaction {
  id: string;
  type: string;
  text?: string;
  author: IPaperAuthorInfo;
  createdAt: string;
}

export interface IPaperAnnotation {
  id: string;
  page: number;
  rect: IPaperRect;
  title?: string;
  text: string;
  author: IPaperAuthorInfo;
  reactions: IPaperReaction[];
  createdAt: string;
  updatedAt?: string;
}

export interface IPaperRegistration {
  id: string;
  sessionId: string;
  userId?: string;
  name: string;
  emailAddress: string;
  courseTaken?: string;
  level?: string;
  registeredAt: string;
  responses?: string;
  status: PaperRegistrationStatusEnum;
  approvalToken: string;
  registeredVia?: string;
  approvedAt?: string;
  rejectedAt?: string;

  // NEW fields for token renewal
  lastTokenIssuedAt?: Date;
  lastToken?: string;
}

export interface IPaper extends Document {
  title: string;
  objective: string;

  sessionId: string;
  createdBy: mongoose.Types.ObjectId;
  sessionStartTime: string;
  sessionEndTime: string;
  qrCodeUrl: string;
  url: string;

  registrations: IPaperRegistration[];

  // Annotations
  annotations: IPaperAnnotation[];
  annotationCount: number;

  maxParticipants?: number;
  isSessionOpen?: boolean;

  createdAt: string;
  updatedAt?: string;
}

// ============================================
// SUB-SCHEMAS
// ============================================

const PaperRectSchema = new Schema<IPaperRect>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const PaperAuthorInfoSchema = new Schema<IPaperAuthorInfo>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    emailAddress: { type: String, required: true },
  },
  { _id: false },
);

const PaperReactionSchema = new Schema<IPaperReaction>(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    type: { type: String, required: true },
    text: { type: String },
    author: { type: PaperAuthorInfoSchema, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false },
);

const PaperAnnotationSchema = new Schema<IPaperAnnotation>(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    page: { type: Number, required: true },
    rect: { type: PaperRectSchema, required: true },
    title: { type: String },
    text: { type: String, required: true },
    author: { type: PaperAuthorInfoSchema, required: true },
    reactions: { type: [PaperReactionSchema], default: [] },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String },
  },
  { _id: false },
);

const PaperRegistrationSchema = new Schema<IPaperRegistration>(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    sessionId: { type: String, required: true },
    userId: { type: String },

    name: { type: String, required: true },

    emailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    courseTaken: { type: String },
    level: { type: String },

    registeredAt: {
      type: String,
      default: () => new Date().toISOString(),
    },

    responses: { type: String },

    status: {
      type: String,
      enum: Object.values(PaperRegistrationStatusEnum),
      default: PaperRegistrationStatusEnum.PENDING,
    },

    approvalToken: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },

    registeredVia: { type: String },

    approvedAt: { type: String },
    rejectedAt: { type: String },

    // New fields for renewal tracking
    lastTokenIssuedAt: { type: Date }, // when the last JWT was minted
    lastToken: { type: String }, // optional: store the last token string
  },
  { _id: false },
);

// ============================================
// MAIN SCHEMA
// ============================================

const PaperSchema = new Schema<IPaper>(
  {
    title: { type: String, required: true },
    objective: { type: String, required: true },

    sessionId: { type: String, required: true },

    qrCodeUrl: { type: String },
    url: { type: String },
    sessionStartTime: { type: String },
    sessionEndTime: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // ✅ SINGLE SOURCE OF TRUTH
    registrations: [PaperRegistrationSchema],

    // Annotations
    annotations: { type: [PaperAnnotationSchema], default: [] },
    annotationCount: { type: Number, default: 0 },

    maxParticipants: { type: Number },
    isSessionOpen: { type: Boolean },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    updatedAt: { type: String },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// VIRTUALS (ALL STATE DERIVED)
// ============================================

PaperSchema.virtual("participants").get(function (this: IPaper) {
  return this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.APPROVED,
  );
});

PaperSchema.virtual("waitingList").get(function (this: IPaper) {
  return this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.WAITING,
  );
});

PaperSchema.virtual("pending").get(function (this: IPaper) {
  return this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.PENDING,
  );
});

PaperSchema.virtual("participantCount").get(function (this: IPaper) {
  return this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.APPROVED,
  ).length;
});

PaperSchema.virtual("availableSpots").get(function (this: IPaper) {
  if (!this.maxParticipants) return null;

  const approved = this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.APPROVED,
  ).length;

  return Math.max(0, this.maxParticipants - approved);
});

PaperSchema.virtual("isFull").get(function (this: IPaper) {
  if (!this.maxParticipants) return false;

  const approved = this.registrations.filter(
    (r) => r.status === PaperRegistrationStatusEnum.APPROVED,
  ).length;

  return approved >= this.maxParticipants;
});

// ============================================
// INDEXES
// ============================================

PaperSchema.index({ sessionId: 1 });
PaperSchema.index({ createdBy: 1 });
PaperSchema.index({ "registrations.emailAddress": 1 });
PaperSchema.index({ isSessionOpen: 1 });
PaperSchema.index({ "annotations.id": 1 });
PaperSchema.index({ "annotations.author.id": 1 });
PaperSchema.index({ "annotations.reactions.id": 1 });

// ============================================
// METHODS
// ============================================

PaperSchema.methods = {
  findRegistration(emailAddress: string) {
    return this.registrations.find(
      (r: IPaperRegistration) => r.emailAddress === emailAddress,
    );
  },

  isUserRegistered(emailAddress: string): boolean {
    return !!this.findRegistration(emailAddress);
  },

  getUserStatus(emailAddress: string): PaperRegistrationStatusEnum | null {
    const r = this.findRegistration(emailAddress);
    return r ? r.status : null;
  },

  // PaperAnnotation methods
  findAnnotation(annotationId: string): IPaperAnnotation | null {
    return (
      this.annotations?.find((a: IPaperAnnotation) => a.id === annotationId) ||
      null
    );
  },

  findReaction(
    reactionId: string,
  ): { annotation: IPaperAnnotation; reaction: IPaperReaction } | null {
    for (const annotation of this.annotations || []) {
      const reaction = annotation.reactions?.find(
        (r: IPaperReaction) => r.id === reactionId,
      );
      if (reaction) {
        return { annotation, reaction };
      }
    }
    return null;
  },
};

// ============================================
// STATICS
// ============================================

PaperSchema.statics = {
  findWithAvailableSpots() {
    return this.find({
      isSessionOpen: true,
      $expr: {
        $gt: [
          "$maxParticipants",
          {
            $size: {
              $filter: {
                input: "$registrations",
                as: "r",
                cond: { $eq: ["$$r.status", "APPROVED"] },
              },
            },
          },
        ],
      },
    });
  },

  async findByAnnotationId(annotationId: string) {
    return this.findOne({ "annotations.id": annotationId });
  },

  async findByReactionId(reactionId: string) {
    return this.findOne({ "annotations.reactions.id": reactionId });
  },
};
PaperSchema.virtual("id").get(function () {
  return this._id.toString();
});
PaperSchema.set("toJSON", { virtuals: true });
PaperSchema.set("toObject", { virtuals: true });
// ============================================
// MODEL
// ============================================

export default mongoose.model<IPaper>("Paper", PaperSchema);
