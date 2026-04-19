import mongoose, { Schema, Document } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IOrganization extends Document {
  name: string;
  type: "GOVERNMENT" | "NGO" | "INTERNATIONAL" | "PRIVATE";
  country?: string;
  createdAt: string;
}

/* ============================================
 SCHEMA
============================================ */

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      
    },

    type: {
      type: String,
      enum: ["GOVERNMENT", "NGO", "INTERNATIONAL", "PRIVATE"],
      required: true,
      
    },

    country: {
      type: String,
      
    },

    createdAt: {
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

// Fast filtering by type + country
OrganizationSchema.index({ type: 1, country: 1 });

/* ============================================
 TRANSFORM
============================================ */

OrganizationSchema.set("toJSON", {
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

export default mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
