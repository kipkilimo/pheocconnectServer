import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import ResponseModel from "../../database/models/Response";

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

export const responseResolver: IResolvers = {
  Mutation: {
    /* ============================================
     ADD RESPONSE ACTION
    ============================================ */

    async addResponseAction(_, { incidentId, pillar, description }, context) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      if (!pillar || pillar.trim().length === 0) {
        throw new Error("Pillar is required");
      }

      if (!description || description.trim().length === 0) {
        throw new Error("Description is required");
      }

      const action = await ResponseModel.create({
        incidentId,
        pillar,
        description,
        status: "PENDING", // default workflow state
        assignedTo: null,
        dueDate: null,
        createdAt: new Date().toISOString(),
        createdBy: context.user.id, // audit trail
      });

      return toId(action);
    },
  },

  /* ============================================
   FIELD RESOLVERS (OPTIONAL)
  ============================================ */

  ResponseAction: {
    // Future expansion:
    // assignee: async (parent) => User.findById(parent.assignedTo)
  },
};

export default responseResolver;
