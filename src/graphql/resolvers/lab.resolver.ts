import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import LabModel from "../../database/models/Lab";

/* ============================================
 HELPERS
============================================ */

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

const toId = (doc: any) => ({
  ...doc,
  id: doc._id.toString(),
});

/* ============================================
 RESOLVER
============================================ */

export const labResolver: IResolvers = {
  Query: {
    /* ============================================
     LAB RESULTS BY CASE
    ============================================ */

    async labResults(_, { caseId }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(caseId)) {
        throw new Error("Invalid case ID");
      }

      const results = await LabModel.find({ caseId })
        .sort({ reportedAt: -1 })
        .lean();

      return results.map(toId);
    },

    /* ============================================
     SINGLE LAB RESULT
    ============================================ */

    async labResult(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid lab result ID");
      }

      const result = await LabModel.findById(id).lean();
      if (!result) throw new Error("Lab result not found");

      return toId(result);
    },
  },

  Mutation: {
    /* ============================================
     ADD LAB RESULT
    ============================================ */

    async addLabResult(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const { caseId, testType, result } = input;

      if (!isValidObjectId(caseId)) {
        throw new Error("Invalid case ID");
      }

      if (!testType || !result) {
        throw new Error("Test type and result are required");
      }

      const lab = await LabModel.create({
        caseId,
        testType,
        result,
        confirmed: false,
        reportedAt: new Date().toISOString(),
      });

      return toId(lab);
    },

    /* ============================================
     CONFIRM LAB RESULT
    ============================================ */

    async confirmLabResult(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid lab result ID");
      }

      const lab = await LabModel.findById(id);
      if (!lab) throw new Error("Lab result not found");

      lab.confirmed = true;
      await lab.save();

      return toId(lab.toObject());
    },
  },
};

export default labResolver;
