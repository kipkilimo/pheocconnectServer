import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IIncident extends Document {
  title: string;
  diseaseId?: mongoose.Types.ObjectId;
  eocId: mongoose.Types.ObjectId;
  status:
    | "REPORTED"
    | "VERIFIED"
    | "CONFIRMED"
    | "RESPONDING"
    | "CONTROLLED"
    | "CLOSED";
  alertLevel: "NORMAL" | "STANDBY" | "ACTIVATED" | "ESCALATED" | "DEACTIVATED";
  cases: number;
  deaths: number;
  createdAt: string;
  updatedAt?: string;
}

/* ============================================
 SCHEMA
============================================ */

const IncidentSchema = new Schema<IIncident>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      
    },

    diseaseId: {
      type: Schema.Types.ObjectId,
      ref: "Disease",
      
    },

    eocId: {
      type: Schema.Types.ObjectId,
      required: true,
      
    },

    status: {
      type: String,
      enum: [
        "REPORTED",
        "VERIFIED",
        "CONFIRMED",
        "RESPONDING",
        "CONTROLLED",
        "CLOSED",
      ],
      default: "REPORTED",
      
    },

    alertLevel: {
      type: String,
      enum: ["NORMAL", "STANDBY", "ACTIVATED", "ESCALATED", "DEACTIVATED"],
      default: "NORMAL",
      
    },

    cases: {
      type: Number,
      default: 0,
    },

    deaths: {
      type: Number,
      default: 0,
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
      
    },

    updatedAt: {
      type: String,
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 INDEXES
============================================ */

IncidentSchema.index({ eocId: 1, status: 1 });
IncidentSchema.index({ alertLevel: 1 });

/* ============================================
 TRANSFORM
============================================ */

IncidentSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString?.() ?? ret.id;

    if (ret._id) {
      delete ret._id;
    }

    return ret;
  },
});

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IIncident>("Incident", IncidentSchema);
