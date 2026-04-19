import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import ResourceModel from "../../database/models/Resource";

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

export const resourceResolver: IResolvers = {
  Query: {
    /* ============================================
     RESOURCES
    ============================================ */

    async resources(_, __, context) {
      if (!context.user) throw new Error("Not authenticated");

      const resources = await ResourceModel.find().lean();
      return resources.map(toId);
    },

    /* ============================================
     DEPLOYMENTS (FROM EMBEDDED DATA)
    ============================================ */

    async deployments(_, { incidentId }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      const resources = await ResourceModel.find({
        "deployments.incidentId": incidentId,
      }).lean();

      const deployments = resources.flatMap((r: any) =>
        (r.deployments || [])
          .filter((d: any) => d.incidentId.toString() === incidentId)
          .map((d: any) => ({
            ...d,
            id: d._id.toString(),
            resourceId: r._id.toString(),
          })),
      );

      return deployments.sort(
        (a, b) =>
          new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime(),
      );
    },
  },

  Mutation: {
    /* ============================================
     DEPLOY RESOURCE
    ============================================ */

    async deployResource(_, { resourceId, incidentId, deployedTo }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(resourceId)) {
        throw new Error("Invalid resource ID");
      }

      if (!isValidObjectId(incidentId)) {
        throw new Error("Invalid incident ID");
      }

      const resource = await ResourceModel.findById(resourceId);
      if (!resource) throw new Error("Resource not found");

      if (resource.quantity <= 0) {
        throw new Error("No available quantity");
      }

      const deployment = {
        resourceId,
        incidentId,
        deployedTo,
        deployedAt: new Date().toISOString(),
      };

      resource.deployments.push(deployment as any);
      resource.quantity -= 1;

      await resource.save();

      const lastDeployment =
        resource.deployments[resource.deployments.length - 1];

      if (!lastDeployment) {
        throw new Error("Deployment not found");
      }

      return {
        id: (lastDeployment as any)._id?.toString?.() ?? "",
        resourceId: resourceId,
        incidentId: incidentId,
        deployedTo: lastDeployment.deployedTo,
        deployedAt: lastDeployment.deployedAt,
        returnedAt: lastDeployment.returnedAt ?? null,
      };
    },
  },
};

export default resourceResolver;
