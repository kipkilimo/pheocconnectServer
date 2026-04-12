import { Document, Types } from "mongoose";

export enum QuestionType {
  QUICK_TRUE_FALSE = "QUICK_TRUE_FALSE",
  EXPANDED_TRUE_FALSE = "EXPANDED_TRUE_FALSE",
  SINGLE_SELECT = "SINGLE_SELECT",
  MULTI_SELECT = "MULTI_SELECT",
  VERY_SHORT_ANSWER = "VERY_SHORT_ANSWER",
  SHORT_ANSWER = "SHORT_ANSWER",
  LONG_ANSWER = "LONG_ANSWER",
}

export enum QuestionSpecialty {
  EPIDEMIOLOGY = "EPIDEMIOLOGY",
  BIOSTATISTICS = "BIOSTATISTICS",
  RESEARCH_METHODS = "RESEARCH_METHODS",
}

export enum DifficultyLevel {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

// For GraphQL responses (matches SDL exactly)
export interface Question {
  id: string;
  shortId: string;
  stem: string;
  choices: string[];
  correctAnswers?: string[];
  explanation?: string;
  tags: string[];
  specialty: QuestionSpecialty;
  topic?: string[]; // Array in GraphQL SDL
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  createdAt: string;
  updatedAt: string;
}

// For Mongoose documents
export interface QuestionDocument extends Document {
  _id: Types.ObjectId;
  shortId: string;
  stem: string;
  choices: string[];
  correctAnswers?: string[];
  explanation?: string;
  tags: string[];
  specialty: QuestionSpecialty;
  topic?: string[]; // Changed from string to string[] to match SDL
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

// For input types
export interface QuestionInput {
  stem: string;
  choices: string[];
  correctAnswers?: string[];
  explanation?: string;
  tags: string[];
  specialty: QuestionSpecialty;
  topic?: string[]; // Changed from string to string[]
  difficulty: DifficultyLevel;
  questionType: QuestionType;
}

export interface RevisionBuilderInput {
  userId: string;
  topic?: string[]; // Changed from string to string[]
  revisionType: string;
  questionTypeDetails: QuestionType;
  count: number;
}

export interface AnswerAccuracy {
  marks: any;
}

export interface BulkQuestionsInput {
  questionsJson: string;
  questionType: QuestionType;
}

export interface BulkQuestionResult {
  successCount: number;
  failCount: number;
  questions: Question[];
  errors: BulkQuestionError[];
}

export interface BulkQuestionError {
  index: number;
  message: string;
  questionData?: string;
}

// Conversion utility - now topic is already an array
export function toQuestionObject(doc: QuestionDocument): Question {
  return {
    id: doc._id.toString(),
    shortId: doc.shortId,
    stem: doc.stem,
    choices: doc.choices,
    correctAnswers: doc.correctAnswers,
    explanation: doc.explanation,
    tags: doc.tags,
    specialty: doc.specialty,
    topic: doc.topic, // Now both are string[] | undefined, no error
    difficulty: doc.difficulty,
    questionType: doc.questionType,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
