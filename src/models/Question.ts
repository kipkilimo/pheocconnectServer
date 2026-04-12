import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

// Interfaces
interface IOpenEndedAnswer {
  submittedAnswer: string;
  accuracy:
    | "CORRECT"
    | "PARTIALLY_CORRECT"
    | "INCORRECT"
    | "MANUAL_REVIEW_NEEDED";
  feedback?: string;
  reviewerId?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

interface IQuestionMetrics {
  timesAttempted: number;
  timesCorrect: number;
  timesPartiallyCorrect: number;
  timesIncorrect: number;
  averageTimeSeconds?: number;
  lastAnsweredAt?: Date;
  openEndedAnswers: IOpenEndedAnswer[];
  confidenceScore?: number;
}

// Main document interfaces
export interface IOpenEndedAnswerDocument extends IOpenEndedAnswer, Document {}
export interface IQuestionMetricsDocument extends IQuestionMetrics, Document {}
export interface IQuestion extends Document {
  shortId: string;
  stem: string;
  choices?: string[];
  correctAnswers?: string[];
  explanation?: string;
  tags: string[];
  specialty: "EPIDEMIOLOGY" | "BIOSTATISTICS" | "RESEARCH_METHODS";
  topic?: string[]; // Changed from string to string[] to match SDL
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType:
    | "QUICK_TRUE_FALSE"
    | "EXPANDED_TRUE_FALSE"
    | "SINGLE_SELECT"
    | "MULTI_SELECT"
    | "VERY_SHORT_ANSWER"
    | "SHORT_ANSWER"
    | "LONG_ANSWER";
  metrics: IQuestionMetricsDocument;
  createdAt: Date;
  updatedAt: Date;
}

// Helper functions
const generateShortId = (): string => {
  return crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/\//g, "_")
    .replace(/\+/g, "-")
    .substring(0, 12);
};

// Sub-schemas
const OpenEndedAnswerSchema = new Schema<IOpenEndedAnswerDocument>(
  {
    submittedAnswer: { type: String, required: true },
    accuracy: {
      type: String,
      required: true,
      enum: [
        "CORRECT",
        "PARTIALLY_CORRECT",
        "INCORRECT",
        "MANUAL_REVIEW_NEEDED",
      ],
      default: "MANUAL_REVIEW_NEEDED",
    },
    feedback: { type: String },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const QuestionMetricsSchema = new Schema<IQuestionMetricsDocument>({
  timesAttempted: { type: Number, required: true, default: 0 },
  timesCorrect: { type: Number, required: true, default: 0 },
  timesPartiallyCorrect: { type: Number, required: true, default: 0 },
  timesIncorrect: { type: Number, required: true, default: 0 },
  averageTimeSeconds: { type: Number },
  lastAnsweredAt: { type: Date },
  openEndedAnswers: { type: [OpenEndedAnswerSchema], default: [] },
  confidenceScore: { type: Number, min: 0, max: 1 },
});

// Main schema
const QuestionSchema = new Schema<IQuestion>(
  {
    shortId: {
      type: String,
      default: generateShortId,
      validate: {
        validator: (v: string) => /^[A-Za-z0-9_-]{12}$/.test(v),
        message: (props) => `${props.value} is not a valid shortId!`,
      },
    },
    stem: { type: String, required: true },
    choices: {
      type: [String],
      validate: {
        validator: function (this: IQuestion, v: string[]) {
          if (
            [
              "VERY_SHORT_ANSWER",
              "QUICK_TRUE_FALSE",
              "SHORT_ANSWER",
              "LONG_ANSWER",
            ].includes(this.questionType)
          ) {
            return v.length === 0;
          }
          return v.length >= 2;
        },
        message: "Invalid choices for the question type.",
      },
    },
    correctAnswers: {
      type: [String],
      validate: {
        validator: function (this: IQuestion, v: string[]) {
          if (this.questionType === "SINGLE_SELECT") return v.length === 1;
          if (this.questionType === "MULTI_SELECT") return v.length > 1;
          return true;
        },
        message: "Invalid correct answer format for the given question type.",
      },
    },
    explanation: { type: String, default: "" },
    tags: { type: [String], required: true, default: [] },
    specialty: {
      type: String,
      required: true,
      enum: ["EPIDEMIOLOGY", "BIOSTATISTICS", "RESEARCH_METHODS"],
    },
    topic: {
      type: [String], // Changed from String to [String]
      default: [], // Default to empty array instead of empty string
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["EASY", "MEDIUM", "HARD"],
    },
    questionType: {
      type: String,
      required: true,
      enum: [
        "QUICK_TRUE_FALSE",
        "EXPANDED_TRUE_FALSE",
        "SINGLE_SELECT",
        "MULTI_SELECT",
        "VERY_SHORT_ANSWER",
        "SHORT_ANSWER",
        "LONG_ANSWER",
      ],
    },
    metrics: {
      type: QuestionMetricsSchema,
      required: true,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

// Indexes - Updated for array field
QuestionSchema.index({ shortId: 1 });
QuestionSchema.index({ specialty: 1, topic: 1 });
QuestionSchema.index({ "metrics.timesAttempted": 1 });
QuestionSchema.index({ "metrics.timesIncorrect": 1 });
QuestionSchema.index({ "metrics.openEndedAnswers.accuracy": 1 });
// Add multikey index for array topics for better query performance
QuestionSchema.index({ topic: 1 });

const Question = mongoose.model<IQuestion>("Question", QuestionSchema);
export default Question;
