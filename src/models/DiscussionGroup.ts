import mongoose, { Schema, Document } from "mongoose";
import User from "./User"; // Adjust import to match your User model location
import Payment from "./Payment"; // Adjust import to match your Payment model location

// Define Course interface
export interface ICourse extends Document {
  courseId: string;
  courseName: string;
  courseCode: string;
  credits: number;
}

// Define Program interface
export interface IProgram extends Document {
  programId: string;
  name: string;
  degree: string;
  duration: string;
  requiredCredits: number;
  coursesOffered: string[];
  payments: string; // Reference to Payment documents
}

// Define DiscussionGroup interface
export interface IDiscussionGroup extends Document {
  discussionGroupId: string;
  name: string;
  createdBy: mongoose.Schema.Types.ObjectId;
  members: mongoose.Types.ObjectId[]; // Reference to User documents
  programs: IProgram[];
}

// Program schema

// DiscussionGroup schema
const discussionGroupSchema: Schema = new Schema({
  discussionGroupId: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  creaatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Reference to User model
  program: { type: String, required: true, trim: true },
});
const DiscussionGroup = mongoose.model<IDiscussionGroup>(
  "DiscussionGroup",
  discussionGroupSchema
);
export default DiscussionGroup;
// Export DiscussionGroup model as default
