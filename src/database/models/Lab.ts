import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface ILabResult extends Document {
  caseId: mongoose.Types.ObjectId;
  testType: string;
  result: string;
  confirmed: boolean;
  reportedAt: string;
}

/* ============================================
 SCHEMA
============================================ */

const LabSchema = new Schema<ILabResult>(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      required: true,
      
    },

    testType: {
      type: String,
      required: true,
      
    },

    result: {
      type: String,
      required: true,
    },

    confirmed: {
      type: Boolean,
      default: false,
      
    },

    reportedAt: {
      type: String,
      default: () => new Date().toISOString(),
      
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 INDEXES
============================================ */

// Fast case-based retrieval
LabSchema.index({ caseId: 1, reportedAt: -1 });

// Confirmation workflows
LabSchema.index({ confirmed: 1 });

/* ============================================
 TRANSFORM
============================================ */

LabSchema.set("toJSON", {
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

export default mongoose.model<ILabResult>("LabResult", LabSchema);
