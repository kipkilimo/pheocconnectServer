import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import CaseModel from "../../database/models/Case"; // adjust path as needed

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

export const surveillanceResolver: IResolvers = {
  Query: {
    /* ============================================
     CASES
    ============================================ */

    async cases(_, { incidentId }, context) {
      // Optional: enforce auth
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      const cases = await CaseModel.find({ incidentId })
        .sort({ reportedAt: -1 })
        .lean();

      return cases.map(toId);
    },
  },

  Mutation: {
    /* ============================================
     ADD CASE
    ============================================ */

    async addCase(
      _,
      { incidentId, classification, patientAge, patientSex, location },
      context,
    ) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      if (!classification) {
        throw new Error("Case classification is required");
      }

      const newCase = await CaseModel.create({
        incidentId,
        classification,
        patientAge: patientAge ?? null,
        patientSex: patientSex ?? null,
        location: location ?? null,
        reportedAt: new Date().toISOString(),
        createdBy: context.user.id, // optional audit trail
      });

      return toId(newCase);
    },
  },

  /* ============================================
   FIELD RESOLVERS (OPTIONAL EXTENSIONS)
  ============================================ */

  Case: {
    // Example: resolve computed or relational fields later
    // incident: async (parent) => IncidentModel.findById(parent.incidentId)
  },
};

export default surveillanceResolver;
