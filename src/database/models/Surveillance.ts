import mongoose, { Schema, Document } from "mongoose";

// ==================== INTERFACES ====================
export interface IDisease extends Document {
  name: string;
  category: string | null;
  notifiable: boolean;
  symptoms: string[];
  incubationPeriod: number | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ICase extends Document {
  incidentId: mongoose.Types.ObjectId;
  classification: "SUSPECTED" | "PROBABLE" | "CONFIRMED" | "NOT_A_CASE";
  patientAge: number | null;
  patientSex: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" | null;
  location: string | null;
  symptoms: string[];
  outcome:
    | "RECOVERED"
    | "HOSPITALIZED"
    | "DECEASED"
    | "UNDER_TREATMENT"
    | "LOST_TO_FOLLOWUP"
    | null;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: mongoose.Types.ObjectId | null;
}

export interface ISurveillanceAlert extends Document {
  title: string;
  description: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "FALSE_ALARM";
  location: string | null;
  diseaseId: mongoose.Types.ObjectId | null;
  incidentId: mongoose.Types.ObjectId | null;
  triggeredBy: mongoose.Types.ObjectId | null;
  detectedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: mongoose.Types.ObjectId | null;
  acknowledgedBy: mongoose.Types.ObjectId | null;
  resolvedBy: mongoose.Types.ObjectId | null;
}

// ==================== SCHEMAS ====================
const DiseaseSchema = new Schema<IDisease>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: null },
    notifiable: { type: Boolean, default: true },
    symptoms: [{ type: String }],
    incubationPeriod: { type: Number, default: null },
  },
  { timestamps: true },
);

const CaseSchema = new Schema<ICase>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    classification: {
      type: String,
      enum: ["SUSPECTED", "PROBABLE", "CONFIRMED", "NOT_A_CASE"],
      required: true,
    },
    patientAge: { type: Number, default: null },
    patientSex: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "UNKNOWN"],
      default: null,
    },
    location: { type: String, default: null },
    symptoms: [{ type: String }],
    outcome: {
      type: String,
      enum: [
        "RECOVERED",
        "HOSPITALIZED",
        "DECEASED",
        "UNDER_TREATMENT",
        "LOST_TO_FOLLOWUP",
      ],
      default: null,
    },
    reportedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

const SurveillanceAlertSchema = new Schema<ISurveillanceAlert>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
    },
    status: {
      type: String,
      enum: ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_ALARM"],
      default: "NEW",
    },
    location: { type: String, default: null },
    diseaseId: { type: Schema.Types.ObjectId, ref: "Disease", default: null },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    detectedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// ==================== INDEXES ====================
CaseSchema.index({ incidentId: 1, reportedAt: -1 });
CaseSchema.index({ classification: 1 });
SurveillanceAlertSchema.index({ incidentId: 1, detectedAt: -1 });
SurveillanceAlertSchema.index({ status: 1, severity: 1 });

// ==================== MODELS ====================
export const DiseaseModel =
  mongoose.models.Disease || mongoose.model<IDisease>("Disease", DiseaseSchema);
export const CaseModel =
  mongoose.models.Case || mongoose.model<ICase>("Case", CaseSchema);
export const SurveillanceAlertModel =
  mongoose.models.SurveillanceAlert ||
  mongoose.model<ISurveillanceAlert>(
    "SurveillanceAlert",
    SurveillanceAlertSchema,
  );
