import mongoose, { Schema, Document } from "mongoose";

enum StudyStage {
  CONCEPTUALIZATION = "CONCEPTUALIZATION",
  PROPOSAL_DEVELOPMENT = "PROPOSAL_DEVELOPMENT",
  ETHICAL_CONSIDERATIONS = "ETHICAL_CONSIDERATIONS",
  POWER_SAMPLE_SIZE_CALCULATION = "POWER_SAMPLE_SIZE_CALCULATION",
  FIELD_ACTIVITY = "FIELD_ACTIVITY",
  REPORT_WRITING = "REPORT_WRITING",
  DISCUSSION = "DISCUSSION",
  MANUSCRIPT_DEVELOPMENT = "MANUSCRIPT_DEVELOPMENT",
}

enum CourseTaken {
  MASTER_OF_SCIENCE = "MASTER_OF_SCIENCE",
  MASTER_OF_MEDICINE = "MASTER_OF_MEDICINE",
  MASTER_OF_PUBLIC_HEALTH = "MASTER_OF_PUBLIC_HEALTH",
  MASTER_OF_ARTS = "MASTER_OF_ARTS",
  DOCTOR_OF_PHILOSOPHY = "DOCTOR_OF_PHILOSOPHY",
}

enum ConsultStage {
  BILLING = "BILLING",
  CONSULTING = "CONSULTING",
  CLOSED = "CLOSED",
}

enum InvoiceStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
}

enum Methodology {
  QUANTITATIVE = "QUANTITATIVE",
  QUALITATIVE = "QUALITATIVE",
  MIXED_METHODS = "MIXED_METHODS",
  SYSTEMATIC_REVIEW = "SYSTEMATIC_REVIEW",
  META_ANALYSIS = "META_ANALYSIS",
  OTHER = "OTHER",
}

interface IDiscussionItem extends Document {
  page?: number;
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  author: string;
  timestamp: Date;
}

const DiscussionItemSchema = new Schema<IDiscussionItem>({
  page: Number,
  text: { type: String, required: true },
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  author: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

interface IInvoice extends Document {
  amount: number;
  status: InvoiceStatus;
  dueDate: Date;
  issuedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.PENDING,
  },
  dueDate: { type: Date, required: true },
  issuedAt: { type: Date, default: Date.now },
});

interface IUploadItem extends Document {
  id: string;
  url: string;
  discussion: IDiscussionItem[];
  description: string;
  createdAt: Date;
  activeDiscussion?: string;
}

const UploadItemSchema = new Schema<IUploadItem>({
  id: { type: String, required: true },
  url: { type: String, required: true },
  discussion: { type: [DiscussionItemSchema], default: [] },
  description: {
    type: String,
    default:
      "Project-related PDF file containing documentation, reports, or specifications.",
  },
  createdAt: { type: Date, default: Date.now },
  activeDiscussion: { type: String, default: "" },
});

interface IConsultation extends Document {
  studentName: string;
  program: CourseTaken;
  level: string;
  status: ConsultStage;
  studyStage: StudyStage;
  methodology?: Methodology;
  consultMembers: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  invoices: IInvoice[];
  uploads: IUploadItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>(
  {
    studentName: { type: String, required: true },
    program: {
      type: String,
      enum: Object.values(CourseTaken),
      required: true,
    },
    level: { type: String, default: "" },
    status: {
      type: String,
      enum: Object.values(ConsultStage),
      required: true,
    },
    studyStage: {
      type: String,
      enum: Object.values(StudyStage),
      required: true,
    },
    methodology: {
      type: String,
      enum: Object.values(Methodology),
    },
    consultMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invoices: [InvoiceSchema],
    uploads: [UploadItemSchema],
  },
  { timestamps: true },
);

UploadItemSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id?.toString() || ret.id;
    // Use delete with optional chaining or reassign instead
    delete (ret as any)._id;
    delete (ret as any).__v;
    // Convert createdAt to ISO string but keep it as a string in the output
    if (ret.createdAt) {
      ret.createdAt = ret.createdAt.toISOString() as any;
    }
  },
});

const Consultation = mongoose.model<IConsultation>(
  "Consultation",
  ConsultationSchema,
);

export default Consultation;
