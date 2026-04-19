import mongoose, { Document, Schema } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IUser extends Document {
  name: string;
  email: string;
  role: "ADMIN" | "EOC_MANAGER" | "ANALYST" | "USER";
  organizationId?: mongoose.Types.ObjectId;
  eocId?: mongoose.Types.ObjectId;
  active: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/* ============================================
 SCHEMA
============================================ */

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    role: {
      type: String,
      enum: ["ADMIN", "EOC_MANAGER", "ANALYST", "USER"],
      required: true,
      default: "USER",
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
    },

    eocId: {
      type: Schema.Types.ObjectId,
      ref: "EOC",
    },

    active: {
      type: Boolean,
      default: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: String, // ISO string (aligned with resolver)
    },

    createdAt: {
      type: String,
      required: true,
      default: () => new Date().toISOString(),
    },
  },
  {
    versionKey: false,
  },
);

/* ============================================
 INDEXES (PERFORMANCE)
============================================ */

// Role-based filtering (admin dashboards)
UserSchema.index({ role: 1 });

// Org / EOC scoping (multi-tenant design)
UserSchema.index({ organizationId: 1, eocId: 1 });

/* ============================================
 TRANSFORMS (CLEAN API OUTPUT)
============================================ */

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString?.() ?? ret.id;

    if ("_id" in ret) {
      delete (ret as any)._id;
    }

    return ret;
  },
});

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IUser>("User", UserSchema);
