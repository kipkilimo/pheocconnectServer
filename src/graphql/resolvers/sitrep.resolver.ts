import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import SitRepModel from "../../database/models/SitRep"; // adjust path as needed
import User from "../../database/models/User";

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

export const sitrepResolver: IResolvers = {
  Query: {
    /* ============================================
     SITREPS
    ============================================ */

    async sitreps(_, { incidentId }, context) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      const sitreps = await SitRepModel.find({ incidentId })
        .sort({ createdAt: -1 })
        .lean();

      return sitreps.map(toId);
    },
  },

  Mutation: {
    /* ============================================
     CREATE SITREP
    ============================================ */

    async createSitRep(_, { input }, context) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      const { incidentId, summary, actions, recommendations } = input;

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      if (!summary || summary.trim().length === 0) {
        throw new Error("Summary is required");
      }

      const sitrep = await SitRepModel.create({
        incidentId,
        summary,
        actions: actions ?? null,
        recommendations: recommendations ?? null,
        createdBy: context.user.id,
        createdAt: new Date().toISOString(),
      });

      return toId(sitrep);
    },

    /* ============================================
     APPROVE SITREP
    ============================================ */

    async approveSitRep(_, { id, userId }, context) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      if (!isValidObjectId(id)) {
        throw new Error("Invalid SitRep ID");
      }

      if (!isValidObjectId(userId)) {
        throw new Error("Invalid user ID");
      }

      // Optional: enforce role-based approval
      const approver = await User.findById(userId);
      if (!approver) {
        throw new Error("Approver not found");
      }

      if (!["ADMIN", "EOC_MANAGER"].includes(approver.role)) {
        throw new Error("User not authorized to approve SitRep");
      }

      const sitrep = await SitRepModel.findById(id);
      if (!sitrep) {
        throw new Error("SitRep not found");
      }

      sitrep.approvedBy = userId;
      await sitrep.save();

      return toId(sitrep.toObject());
    },
  },

  /* ============================================
   FIELD RESOLVERS (OPTIONAL)
  ============================================ */

  SitRep: {
    // Example future extension:
    // creator: async (parent) => User.findById(parent.createdBy)
    // approver: async (parent) => User.findById(parent.approvedBy)
  },
};

export default sitrepResolver;
