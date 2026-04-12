// models/Paper.ts
import mongoose, { Schema, Document } from "mongoose";

// ============================================
// ENUMS
// ============================================

export enum RegistrationStatusEnum {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum PaperStatusEnum {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

// ============================================
// INTERFACES
// ============================================

// Rect interface for annotation position
export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Author info interface
export interface IAuthorInfo {
  id: string;
  name: string;
  email: string;
}

// Reaction interface
export interface IReaction {
  id: string;
  type: string;
  text?: string;
  author: IAuthorInfo;
  createdAt: string;
}

// Annotation interface
export interface IAnnotation {
  id: string;
  page: number;
  rect: IRect;
  title?: string;
  text: string;
  author: IAuthorInfo;
  reactions: IReaction[];
  createdAt: string;
  updatedAt?: string;
}

// Live Session interface
export interface ILiveSession {
  isActive: boolean;
  startedAt?: string;
  endedAt?: string;
  currentPage?: number;
  activeAnnotationId?: string;
  controllerId?: mongoose.Types.ObjectId;
  participants?: mongoose.Types.ObjectId[];
}

// Access Request interface
export interface IAccessRequest {
  id: string;
  email: string;
  name: string;
  reason?: string;
  requestedAt: string;
  status: string; // "PENDING" | "APPROVED" | "DENIED"
  approvedAt?: string;
  deniedAt?: string;
}

// Approved Collaborator interface
export interface IApprovedCollaborator {
  email: string;
  name: string;
  approvedAt: string;
  approvedBy: mongoose.Types.ObjectId;
}

// Pre-registration Detail interface
export interface IPreRegistrationDetail {
  id: string;
  sessionId?: string;
  userId?: string;
  name: string;
  emailAddress: string;
  email?: string;
  courseTaken?: string;
  level?: string;
  registeredAt: string;
  responses?: string;
  status: RegistrationStatusEnum;
  approvalToken: string;
  registeredVia?: string;
  approvedAt?: string;
}

// Session Registration for waiting list
export interface ISessionRegistration {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  courseTaken?: string;
  level?: string;
  registeredAt: string;
  status: RegistrationStatusEnum;
  approvalToken: string;
  approvedAt?: string;
  registeredVia?: string;
}

// Main Paper interface
export interface IPaper extends Document {
  title: string;
  objective: string;
  url?: string;
  accessKey?: string;
  sessionId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdDate?: string;
  journalClubEventDate?: string;
  status: PaperStatusEnum;

  // Annotation system
  annotations: mongoose.Types.ObjectId[];
  annotationCount: number;

  // Live session
  liveSession: ILiveSession;

  // QR Code & Access Management
  qrCodeUrl?: string;
  qrCodePdfPath?: string;
  joinUrl?: string;
  pendingRequests: IAccessRequest[];
  approvedCollaborators: IApprovedCollaborator[];

  // Participant Management
  participants: IPreRegistrationDetail[];
  waitingList: ISessionRegistration[];
  admittedParticipants: IPreRegistrationDetail[];
  maxParticipants?: number;
  isSessionOpen?: boolean;
  sessionStartTime?: string;
  sessionEndTime?: string;
}

// ============================================
// SUB-SCHEMAS
// ============================================

// Rect Schema
const RectSchema = new Schema<IRect>({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
});

// Author Info Schema
const AuthorInfoSchema = new Schema<IAuthorInfo>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
});

// Reaction Schema
const ReactionSchema = new Schema<IReaction>({
  id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  type: { type: String, required: true },
  text: { type: String },
  author: { type: AuthorInfoSchema, required: true },
  createdAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
});

// Annotation Schema (embedded, not referenced)
const AnnotationSchema = new Schema<IAnnotation>({
  id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  page: { type: Number, required: true },
  rect: { type: RectSchema, required: true },
  title: { type: String },
  text: { type: String, required: true },
  author: { type: AuthorInfoSchema, required: true },
  reactions: [ReactionSchema],
  createdAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  updatedAt: { type: String },
});

// Live Session Schema
const LiveSessionSchema = new Schema<ILiveSession>({
  isActive: { type: Boolean, default: false },
  startedAt: { type: String },
  endedAt: { type: String },
  currentPage: { type: Number, default: 1 },
  activeAnnotationId: { type: String },
  controllerId: { type: Schema.Types.ObjectId, ref: "User" },
  participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

// Access Request Schema
const AccessRequestSchema = new Schema<IAccessRequest>({
  id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  email: { type: String, required: true },
  name: { type: String, required: true },
  reason: { type: String },
  requestedAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "DENIED"],
    default: "PENDING",
    required: true,
  },
  approvedAt: { type: String },
  deniedAt: { type: String },
});

// Approved Collaborator Schema
const ApprovedCollaboratorSchema = new Schema<IApprovedCollaborator>({
  email: { type: String, required: true },
  name: { type: String, required: true },
  approvedAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

// Pre-registration Detail Schema
const PreRegistrationDetailSchema = new Schema<IPreRegistrationDetail>({
  id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  sessionId: { type: String },
  userId: { type: String },
  name: { type: String, required: true },
  emailAddress: { type: String, required: true },
  email: { type: String },
  courseTaken: { type: String },
  level: { type: String },
  registeredAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  responses: { type: String },
  status: {
    type: String,
    enum: Object.values(RegistrationStatusEnum),
    default: RegistrationStatusEnum.PENDING,
    required: true,
  },
  approvalToken: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  registeredVia: { type: String },
  approvedAt: { type: String },
});

// Session Registration Schema (for waiting list)
const SessionRegistrationSchema = new Schema<ISessionRegistration>({
  id: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  sessionId: { type: String, required: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  courseTaken: { type: String },
  level: { type: String },
  registeredAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString(),
  },
  status: {
    type: String,
    enum: Object.values(RegistrationStatusEnum),
    default: RegistrationStatusEnum.PENDING,
    required: true,
  },
  approvalToken: {
    type: String,
    required: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  approvedAt: { type: String },
  registeredVia: { type: String },
});

// ============================================
// MAIN SCHEMA
// ============================================

const PaperSchema = new Schema<IPaper>(
  {
    title: { type: String, required: true },
    objective: { type: String, required: true },
    url: { type: String },
    accessKey: { type: String, required: true },
    sessionId: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdDate: { type: String, default: () => new Date().toISOString() },
    journalClubEventDate: { type: String },
    status: {
      type: String,
      enum: Object.values(PaperStatusEnum),
      default: PaperStatusEnum.DRAFT,
    },

    // Annotation system - using embedded documents for annotations
    annotations: [AnnotationSchema],
    annotationCount: { type: Number, default: 0 },

    // Live session
    liveSession: { type: LiveSessionSchema, default: () => ({}) },

    // QR Code & Access Management
    qrCodeUrl: { type: String },
    qrCodePdfPath: { type: String },
    joinUrl: { type: String },
    pendingRequests: [AccessRequestSchema],
    approvedCollaborators: [ApprovedCollaboratorSchema],

    // Participant Management
    participants: [PreRegistrationDetailSchema],
    waitingList: [SessionRegistrationSchema],
    admittedParticipants: [PreRegistrationDetailSchema],
    maxParticipants: { type: Number, default: 100 },
    isSessionOpen: { type: Boolean, default: false },
    sessionStartTime: { type: String },
    sessionEndTime: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// VIRTUAL FIELDS
// ============================================

// Available spots for the paper session
PaperSchema.virtual("availableSpots").get(function (this: IPaper) {
  if (!this.maxParticipants) return Infinity;
  const participantCount = this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.APPROVED,
  ).length;
  return Math.max(0, this.maxParticipants - participantCount);
});

// Check if the paper session is full
PaperSchema.virtual("isFull").get(function (this: IPaper) {
  if (!this.maxParticipants) return false;
  const participantCount = this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.APPROVED,
  ).length;
  return participantCount >= this.maxParticipants;
});

// Count of approved participants
PaperSchema.virtual("participantCount").get(function (this: IPaper) {
  return this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.APPROVED,
  ).length;
});

// Count of pending registrations
PaperSchema.virtual("pendingRegistrationsCount").get(function (this: IPaper) {
  return this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.PENDING,
  ).length;
});

// Count of approved registrations
PaperSchema.virtual("approvedRegistrationsCount").get(function (this: IPaper) {
  return this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.APPROVED,
  ).length;
});

// Count of rejected registrations
PaperSchema.virtual("rejectedRegistrationsCount").get(function (this: IPaper) {
  return this.participants.filter(
    (p) => p.status === RegistrationStatusEnum.REJECTED,
  ).length;
});

// ============================================
// INDEXES
// ============================================

// Single field indexes
PaperSchema.index({ sessionId: 1 });
PaperSchema.index({ accessKey: 1 });
PaperSchema.index({ createdBy: 1 });
PaperSchema.index({ status: 1 });
PaperSchema.index({ "participants.emailAddress": 1 });
PaperSchema.index({ "participants.status": 1 });
PaperSchema.index({ "waitingList.email": 1 });
PaperSchema.index({ isSessionOpen: 1 });
PaperSchema.index({ sessionStartTime: 1 });
PaperSchema.index({ sessionEndTime: 1 });
PaperSchema.index({ createdDate: 1 });

// Compound indexes for common queries
PaperSchema.index({ status: 1, isSessionOpen: 1 });
PaperSchema.index({ createdBy: 1, status: 1 });
PaperSchema.index({ sessionId: 1, "participants.emailAddress": 1 });
PaperSchema.index({ status: 1, createdDate: -1 });

// Text search index
PaperSchema.index({ title: "text", objective: "text" });

// ============================================
// METHODS
// ============================================

PaperSchema.methods = {
  // Check if a user is registered
  isUserRegistered(email: string): boolean {
    return this.participants.some(
      (p: IPreRegistrationDetail) =>
        p.emailAddress === email || p.email === email,
    );
  },

  // Get registration status for a user
  getUserRegistrationStatus(email: string): RegistrationStatusEnum | null {
    const registration = this.participants.find(
      (p: IPreRegistrationDetail) =>
        p.emailAddress === email || p.email === email,
    );
    return registration ? registration.status : null;
  },

  // Check if user is on waiting list
  isOnWaitingList(email: string): boolean {
    return this.waitingList.some(
      (w: ISessionRegistration) => w.email === email,
    );
  },

  // Check if session is accessible
  isSessionAccessible(): boolean {
    if (!this.isSessionOpen) return false;

    const now = new Date().toISOString();
    if (this.sessionStartTime && now < this.sessionStartTime) return false;
    if (this.sessionEndTime && now > this.sessionEndTime) return false;

    return true;
  },

  // Get available spots count
  getAvailableSpots(): number {
    return this.availableSpots;
  },

  // Add annotation
  addAnnotation(annotationData: Partial<IAnnotation>): IAnnotation {
    const annotation = {
      id: new mongoose.Types.ObjectId().toString(),
      ...annotationData,
      createdAt: new Date().toISOString(),
      reactions: [],
    } as IAnnotation;

    this.annotations.push(annotation);
    this.annotationCount = this.annotations.length;
    return annotation;
  },

  // Update annotation
  updateAnnotation(
    annotationId: string,
    updates: Partial<IAnnotation>,
  ): IAnnotation | null {
    const annotation = this.annotations.find(
      (a: IAnnotation) => a.id === annotationId,
    );
    if (annotation) {
      Object.assign(annotation, updates);
      annotation.updatedAt = new Date().toISOString();
    }
    return annotation;
  },

  // Delete annotation
  deleteAnnotation(annotationId: string): boolean {
    const index = this.annotations.findIndex(
      (a: IAnnotation) => a.id === annotationId,
    );
    if (index !== -1) {
      this.annotations.splice(index, 1);
      this.annotationCount = this.annotations.length;
      return true;
    }
    return false;
  },
};

// ============================================
// STATICS
// ============================================

PaperSchema.statics = {
  // Find active sessions
  findActiveSessions() {
    return this.find({
      status: PaperStatusEnum.ACTIVE,
      isSessionOpen: true,
    }).sort({ createdDate: -1 });
  },

  // Find sessions by participant email
  findByParticipantEmail(email: string) {
    return this.find({
      "participants.emailAddress": email,
      "participants.status": RegistrationStatusEnum.APPROVED,
    });
  },

  // Find sessions with available spots
  findWithAvailableSpots() {
    return this.find({
      status: PaperStatusEnum.ACTIVE,
      isSessionOpen: true,
      $expr: {
        $gt: ["$maxParticipants", { $size: "$participants" }],
      },
    });
  },

  // Find upcoming sessions
  findUpcomingSessions() {
    const now = new Date().toISOString();
    return this.find({
      status: PaperStatusEnum.ACTIVE,
      sessionStartTime: { $gt: now },
    }).sort({ sessionStartTime: 1 });
  },

  // Search papers by text
  searchPapers(searchText: string) {
    return this.find(
      { $text: { $search: searchText } },
      { score: { $meta: "textScore" } },
    ).sort({ score: { $meta: "textScore" } });
  },
};

// ============================================
// MODEL
// ============================================

export default mongoose.model<IPaper>("Paper", PaperSchema);
