import mongoose, { Document, Schema } from "mongoose";

/* ============================================
 TYPES
============================================ */

export interface IUser extends Document {
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "EOC_MANAGER" | "ANALYST" | "PUBLIC";
  organizationId?: string;
  eocId?: string[];
  active: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  lastOTPSentAt?: Date;
  otpEnabled?: boolean;
  otpAttempts?: number;
  lastOTPVerifiedAt?: Date;

  // Instance methods
  updateLastOTPSent(): Promise<boolean>;
  needsMFA(): boolean;
  updateLastLogin(): Promise<boolean>;
  incrementOTPAttempts(): Promise<number>;
  resetOTPAttempts(): Promise<boolean>;
  getOTPStatus(): any;
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
      index: true,
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "EOC_MANAGER", "ANALYST", "PUBLIC"],
      required: true,
      default: "PUBLIC",
    },
    organizationId: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    eocId: {
      type: [String],
      default: [],
      required: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    updatedAt: {
      type: Date,
      default: () => new Date(),
    },
    lastOTPSentAt: {
      type: Date,
      required: false,
    },
    otpEnabled: {
      type: Boolean,
      default: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    lastOTPVerifiedAt: {
      type: Date,
      required: false,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

/* ============================================
 INDEXES
============================================ */

UserSchema.index({ role: 1 });
UserSchema.index({ organizationId: 1 });
UserSchema.index({ eocId: 1 });
UserSchema.index({ active: 1, role: 1 });
UserSchema.index({ createdAt: -1 });

/* ============================================
 TRANSFORMS
============================================ */

UserSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    const { _id, __v, ...rest } = ret;
    return {
      ...rest,
      id: _id?.toString(),
    };
  },
});

UserSchema.set("toObject", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    const { _id, __v, ...rest } = ret;
    return {
      ...rest,
      id: _id?.toString(),
    };
  },
});

/* ============================================
 PRE-SAVE MIDDLEWARE
============================================ */

UserSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (this.organizationId === "") {
    this.organizationId = null as any;
  }
  if (this.eocId && Array.isArray(this.eocId)) {
    this.eocId = this.eocId.filter((id) => id && id.trim() !== "");
  }
  if (this.otpAttempts && this.otpAttempts >= 10) {
    this.otpAttempts = 0;
  }
  next();
});

/* ============================================
 INSTANCE METHODS
============================================ */

UserSchema.methods.updateLastOTPSent = async function () {
  this.lastOTPSentAt = new Date();
  await this.save();
  return true;
};

UserSchema.methods.needsMFA = function () {
  return (this.otpEnabled || !this.emailVerified) && this.active;
};

UserSchema.methods.updateLastLogin = async function () {
  this.lastLoginAt = new Date();
  await this.save();
  return true;
};

UserSchema.methods.incrementOTPAttempts = async function () {
  this.otpAttempts = (this.otpAttempts || 0) + 1;
  await this.save();
  return this.otpAttempts;
};

UserSchema.methods.resetOTPAttempts = async function () {
  this.otpAttempts = 0;
  await this.save();
  return true;
};

UserSchema.methods.getOTPStatus = function () {
  return {
    enabled: this.otpEnabled || false,
    emailVerified: this.emailVerified,
    lastSentAt: this.lastOTPSentAt,
    lastVerifiedAt: this.lastOTPVerifiedAt,
    attemptsRemaining: this.otpAttempts
      ? Math.max(0, 10 - this.otpAttempts)
      : 10,
  };
};

/* ============================================
 STATIC METHODS
============================================ */

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findActive = function () {
  return this.find({ active: true });
};

UserSchema.statics.findByEOC = function (eocId: string) {
  return this.find({ eocId: eocId, active: true });
};

/* ============================================
 EXPORT
============================================ */

export default mongoose.model<IUser>("User", UserSchema);
