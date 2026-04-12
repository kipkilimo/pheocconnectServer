import mongoose, { Document, Schema, Types } from "mongoose";

/* ============================================
   SUBDOCUMENTS
============================================ */

const RectSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const AuthorInfoSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false },
);

/* ============================================
   REACTION (FIXED TYPE SAFETY)
============================================ */

const ReactionSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "COMMENT",
        "CONCUR",
        "DISAGREE",
        "APPLAUSE",
        "QUESTION",
        "INSIGHT",
      ],
    },
    text: { type: String },
    author: { type: AuthorInfoSchema, required: true },
    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { _id: false },
);

/* ============================================
   MAIN INTERFACE
============================================ */

export interface IAnnotation extends Document {
  paperId: Types.ObjectId;

  page: number;

  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  title?: string;
  text: string;

  author: {
    id: Types.ObjectId;
    name: string;
    email: string;
  };

  reactions: any[];

  createdAt: string;
  updatedAt?: string;
}

/* ============================================
   MAIN SCHEMA
============================================ */

const AnnotationSchema = new Schema<IAnnotation>(
  {
    paperId: {
      type: Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
      index: true,
    },

    page: {
      type: Number,
      required: true,
      index: true,
    },

    rect: {
      type: RectSchema,
      required: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 255,
    },

    text: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    author: {
      type: AuthorInfoSchema,
      required: true,
    },

    // ✅ FIX: avoid TS schema inference conflict
    reactions: {
      type: [ReactionSchema as any],
      default: [],
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
    timestamps: false,
  },
);

/* ============================================
   INDEXES
============================================ */

AnnotationSchema.index({ paperId: 1, page: 1 });
AnnotationSchema.index({ createdAt: -1 });

/* ============================================
   MIDDLEWARE
============================================ */

AnnotationSchema.pre("save", function (next) {
  this.updatedAt = new Date().toISOString();
  next();
});

/* ============================================
   EXPORT
============================================ */

const Annotation = mongoose.model<IAnnotation>("Annotation", AnnotationSchema);

export default Annotation;
