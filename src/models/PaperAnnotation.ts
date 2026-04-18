import mongoose, { Schema, Document, Model } from "mongoose";

//
// ============================================
// INTERFACES
// ============================================
//

export interface IAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IAnnotationAuthor {
  id: string;
  name: string;
  email: string;
}

export interface IAnnotationReaction {
  id: string;
  type: string;
  text?: string;
  author: IAnnotationAuthor;
  createdAt: string;
}

export interface IAnnotation extends Document {
  paperId: mongoose.Types.ObjectId;
  page: number;
  rect: IAnnotationRect;
  title?: string;
  text: string;
  author: IAnnotationAuthor;
  reactions: IAnnotationReaction[];
  createdAt: string;
  updatedAt?: string;
}

//
// ============================================
// SUB SCHEMAS
// ============================================
//

const AnnotationRectSchema = new Schema<IAnnotationRect>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const AnnotationAuthorSchema = new Schema<IAnnotationAuthor>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
  },
  { _id: false },
);

const AnnotationReactionSchema = new Schema<IAnnotationReaction>(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    type: { type: String, required: true },
    text: { type: String },

    author: {
      type: AnnotationAuthorSchema,
      required: true,
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { _id: false },
);

//
// ============================================
// MAIN SCHEMA
// ============================================
//

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
      type: AnnotationRectSchema,
      required: true,
    },

    title: { type: String },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: AnnotationAuthorSchema,
      required: true,
    },

    reactions: {
      type: [AnnotationReactionSchema],
      default: [],
    },

    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },

    updatedAt: { type: String },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

//
// ============================================
// INDEXES
// ============================================
//

AnnotationSchema.index({ paperId: 1, page: 1 });
AnnotationSchema.index({ "author.email": 1 });
AnnotationSchema.index({ createdAt: -1 });

//
// ============================================
// METHODS
// ============================================
//

AnnotationSchema.methods.updateContent = function (
  updates: Partial<IAnnotation>,
) {
  Object.assign(this, updates);
  this.updatedAt = new Date().toISOString();
  return this;
};

AnnotationSchema.methods.addReaction = function (
  reaction: Omit<IAnnotationReaction, "id" | "createdAt">,
) {
  const newReaction = {
    id: new mongoose.Types.ObjectId().toString(),
    ...reaction,
    createdAt: new Date().toISOString(),
  };

  this.reactions.push(newReaction);
  this.updatedAt = new Date().toISOString();

  return newReaction;
};

AnnotationSchema.methods.removeReaction = function (reactionId: string) {
  const index = this.reactions.findIndex((r: any) => r.id === reactionId);

  if (index === -1) return false;

  this.reactions.splice(index, 1);
  this.updatedAt = new Date().toISOString();

  return true;
};

//
// ============================================
// STATICS
// ============================================
//

interface AnnotationModel extends Model<IAnnotation> {
  findByPaper(
    paperId: string,
    page?: number,
    limit?: number,
  ): Promise<IAnnotation[]>;
}

AnnotationSchema.statics.findByPaper = function (
  paperId: string,
  page?: number,
  limit = 100,
) {
  const query: any = { paperId };

  if (page !== undefined) {
    query.page = page;
  }

  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

//
// ============================================
// MODEL
// ============================================
//

export default mongoose.model<IAnnotation, AnnotationModel>(
  "PaperAnnotation",
  AnnotationSchema,
);
