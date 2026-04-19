import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IResponse extends Document {
  incidentId: mongoose.Types.ObjectId;
  pillar: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedTo?: mongoose.Types.ObjectId;
  dueDate?: string;
  createdAt: string;
  createdBy?: mongoose.Types.ObjectId;
}

/* ============================================
 SCHEMA
============================================ */

const ResponseSchema = new Schema<IResponse>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      required: true,
      
    },

    pillar: {
      type: String,
      required: true,
      trim: true,
      
    },

    description: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      
    },

    dueDate: {
      type: String, // ISO string
    },

    createdAt: {
      type: String,
      required: true,
      default: () => new Date().toISOString(),
      
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 INDEXES (PERFORMANCE)
============================================ */

// Incident dashboard filtering
ResponseSchema.index({ incidentId: 1, status: 1 });

// Pillar-based coordination
ResponseSchema.index({ incidentId: 1, pillar: 1 });

// Task assignment queries
ResponseSchema.index({ assignedTo: 1, status: 1 });

/* ============================================
 TRANSFORM
============================================ */

ResponseSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const { _id, __v, ...clean } = ret as any;

    return {
      ...clean,
      id: _id?.toString?.(),
    };
  },
});

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IResponse>("Response", ResponseSchema);
