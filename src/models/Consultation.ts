import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 ENUMS
============================================ */

export enum StudyStage {
  CONCEPTUALIZATION = "CONCEPTUALIZATION",
  PROPOSAL_DEVELOPMENT = "PROPOSAL_DEVELOPMENT",
  ETHICAL_CONSIDERATIONS = "ETHICAL_CONSIDERATIONS",
  POWER_SAMPLE_SIZE_CALCULATION = "POWER_SAMPLE_SIZE_CALCULATION",
  FIELD_ACTIVITY = "FIELD_ACTIVITY",
  REPORT_WRITING = "REPORT_WRITING",
  DISCUSSION = "DISCUSSION",
  MANUSCRIPT_DEVELOPMENT = "MANUSCRIPT_DEVELOPMENT",
}

export enum CourseTaken {
  MASTER_OF_SCIENCE = "MASTER_OF_SCIENCE",
  MASTER_OF_MEDICINE = "MASTER_OF_MEDICINE",
  MASTER_OF_PUBLIC_HEALTH = "MASTER_OF_PUBLIC_HEALTH",
  MASTER_OF_ARTS = "MASTER_OF_ARTS",
  DOCTOR_OF_PHILOSOPHY = "DOCTOR_OF_PHILOSOPHY",
}

export enum ConsultStage {
  BILLING = "BILLING",
  CONSULTING = "CONSULTING",
  CLOSED = "CLOSED",
}

export enum Methodology {
  QUANTITATIVE = "QUANTITATIVE",
  QUALITATIVE = "QUALITATIVE",
  MIXED_METHODS = "MIXED_METHODS",
  SYSTEMATIC_REVIEW = "SYSTEMATIC_REVIEW",
  META_ANALYSIS = "META_ANALYSIS",
  OTHER = "OTHER",
}

enum InvoiceStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
}

/* ============================================
 BASIC STRUCTURES
============================================ */

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IAuthor {
  id: string;
  name: string;
  email: string;
  color: string;
}

interface IAnnotation {
  id: string;
  page: number;
  rect: IRect;
  text: string;
  author: IAuthor;
  createdAt: string;
  updatedAt?: string;
}

interface ILiveSession {
  isActive: boolean;
  currentPage?: number;
  activeAnnotationId?: string;
}

interface IInvoice {
  amount: number;
  status: InvoiceStatus;
  dueDate: Date;
  issuedAt: Date;
}

/* ============================================
 SCHEMAS
============================================ */

const RectSchema = new Schema<IRect>({
  x: Number,
  y: Number,
  width: Number,
  height: Number,
});

const AuthorSchema = new Schema<IAuthor>({
  id: String,
  name: String,
  email: String,
  color: { type: String, required: true },
});

const AnnotationSchema = new Schema<IAnnotation>({
  id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  page: { type: Number, required: true },
  rect: { type: RectSchema, required: true },
  text: { type: String, required: true },
  author: { type: AuthorSchema, required: true },
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  updatedAt: String,
});

const LiveSessionSchema = new Schema<ILiveSession>({
  isActive: { type: Boolean, default: false },
  currentPage: Number,
  activeAnnotationId: String,
});

const InvoiceSchema = new Schema<IInvoice>({
  amount: Number,
  status: {
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.PENDING,
  },
  dueDate: Date,
  issuedAt: { type: Date, default: Date.now },
});

/* ============================================
 METHODS TYPES
============================================ */

interface IConsultationMethods {
  addAnnotation(data: Partial<IAnnotation>): IAnnotation;
  updateAnnotation(
    id: string,
    updates: Partial<IAnnotation>,
  ): IAnnotation | null;
  deleteAnnotation(id: string): boolean;
}

/* ============================================
 MAIN DOCUMENT
============================================ */

export interface IConsultation extends Document, IConsultationMethods {
  title: string;
  studentName: string;

  program: CourseTaken;
  level?: string;

  studyStage: StudyStage;
  methodology?: Methodology;
  status: ConsultStage;

  sessionId: string;
  url?: string;

  createdBy: mongoose.Types.ObjectId;

  externalParticipants: IAuthor[];

  annotations: IAnnotation[];
  annotationCount: number;

  liveSession?: ILiveSession;

  invoices: IInvoice[];

  createdAt: string;
  updatedAt?: string;
}

/* ============================================
 SCHEMA
============================================ */

const ConsultationSchema = new Schema<IConsultation>(
  {
    title: { type: String, required: true },
    studentName: { type: String, required: true },

    program: { type: String, enum: Object.values(CourseTaken) },
    level: String,

    studyStage: { type: String, enum: Object.values(StudyStage) },
    methodology: { type: String, enum: Object.values(Methodology) },

    status: { type: String, enum: Object.values(ConsultStage) },

    sessionId: { type: String, required: true },
    url: String,

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    externalParticipants: {
      type: [AuthorSchema],
      validate: {
        validator: (val: IAuthor[]) => val.length <= 3,
        message: "Maximum of 3 external participants allowed",
      },
      default: [],
    },

    annotations: [AnnotationSchema],
    annotationCount: { type: Number, default: 0 },

    liveSession: LiveSessionSchema,

    invoices: [InvoiceSchema],

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    updatedAt: String,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* ============================================
 METHODS IMPLEMENTATION (SAFE)
============================================ */

ConsultationSchema.methods.addAnnotation = function (
  this: IConsultation,
  data: Partial<IAnnotation>,
): IAnnotation {
  if (!data.page || !data.rect || !data.text || !data.author) {
    throw new Error("Invalid annotation payload");
  }

  const annotation: IAnnotation = {
    id: new mongoose.Types.ObjectId().toString(),
    page: data.page,
    rect: data.rect,
    text: data.text,
    author: data.author,
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
  };

  this.annotations.push(annotation);
  this.annotationCount = this.annotations.length;

  return annotation;
};

ConsultationSchema.methods.updateAnnotation = function (
  this: IConsultation,
  id: string,
  updates: Partial<IAnnotation>,
): IAnnotation | null {
  const ann = this.annotations.find((a: IAnnotation) => a.id === id);

  if (!ann) return null;

  Object.assign(ann, updates);
  ann.updatedAt = new Date().toISOString();

  return ann;
};

ConsultationSchema.methods.deleteAnnotation = function (
  this: IConsultation,
  id: string,
): boolean {
  const index = this.annotations.findIndex((a: IAnnotation) => a.id === id);

  if (index === -1) return false;

  this.annotations.splice(index, 1);
  this.annotationCount = this.annotations.length;

  return true;
};

/* ============================================
 INDEXES
============================================ */

ConsultationSchema.index({ sessionId: 1 });
ConsultationSchema.index({ createdBy: 1 });
ConsultationSchema.index({ status: 1 });

/* ============================================
 MODEL
============================================ */

export default mongoose.model<IConsultation>(
  "Consultation",
  ConsultationSchema,
);
