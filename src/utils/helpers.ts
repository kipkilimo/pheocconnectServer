import mongoose from "mongoose";

export const isValidObjectId = (id: string) =>
  mongoose.Types.ObjectId.isValid(id);

export const toId = (doc: any) => ({
  ...doc,
  id: doc._id.toString(),
});