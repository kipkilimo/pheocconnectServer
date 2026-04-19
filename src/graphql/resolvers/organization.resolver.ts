import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import OrganizationModel from "../../database/models/Organization";
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

export const organizationResolver: IResolvers = {
  Query: {
    /* ============================================
     ALL ORGANIZATIONS
    ============================================ */

    async organizations(_, __, context) {
      if (!context.user) throw new Error("Not authenticated");

      const orgs = await OrganizationModel.find().lean();
      return orgs.map(toId);
    },

    /* ============================================
     SINGLE ORGANIZATION
    ============================================ */

    async organization(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid organization ID");
      }

      const org = await OrganizationModel.findById(id).lean();
      if (!org) throw new Error("Organization not found");

      return toId(org);
    },

    /* ============================================
     FILTER BY TYPE
    ============================================ */

    async organizationsByType(_, { type }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const orgs = await OrganizationModel.find({ type }).lean();
      return orgs.map(toId);
    },

    /* ============================================
     MY ORGANIZATION
    ============================================ */

    async myOrganization(_, __, context) {
      if (!context.user) throw new Error("Not authenticated");

      const orgId = context.user.organizationId;
      if (!orgId) return null;

      if (!isValidObjectId(orgId)) {
        throw new Error("Invalid organization ID");
      }

      const org = await OrganizationModel.findById(orgId).lean();
      if (!org) throw new Error("Organization not found");

      return toId(org);
    },
  },

  Mutation: {
    /* ============================================
     CREATE ORGANIZATION
    ============================================ */

    async createOrganization(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const { name, type, country } = input;

      if (!name || name.trim().length === 0) {
        throw new Error("Organization name is required");
      }

      if (!type) {
        throw new Error("Organization type is required");
      }

      // Prevent duplicates (basic safeguard)
      const exists = await OrganizationModel.findOne({
        name: name.trim(),
      });

      if (exists) {
        throw new Error("Organization already exists");
      }

      const org = await OrganizationModel.create({
        name: name.trim(),
        type,
        country: country ?? null,
        createdAt: new Date().toISOString(),
      });

      return toId(org);
    },

    /* ============================================
     UPDATE ORGANIZATION
    ============================================ */

    async updateOrganization(_, { id, input }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid organization ID");
      }

      const updateData: any = {};

      if (input.name !== undefined) {
        if (!input.name.trim()) {
          throw new Error("Name cannot be empty");
        }
        updateData.name = input.name.trim();
      }

      if (input.type !== undefined) {
        updateData.type = input.type;
      }

      if (input.country !== undefined) {
        updateData.country = input.country;
      }

      const updated = await OrganizationModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true },
      );

      if (!updated) {
        throw new Error("Organization not found");
      }

      return toId(updated.toObject());
    },

    /* ============================================
     DELETE ORGANIZATION
    ============================================ */

    async deleteOrganization(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid organization ID");
      }

      const org = await OrganizationModel.findByIdAndDelete(id);

      return !!org;
    },
  },

  /* ============================================
   FIELD RESOLVERS
  ============================================ */

  Organization: {
    async users(parent) {
      if (!mongoose.Types.ObjectId.isValid(parent.id)) {
        return [];
      }

      const users = await User.find({
        organizationId: parent.id,
        active: true,
      }).lean();

      return users.map((u) => ({
        ...u,
        id: u._id.toString(),
      }));
    },
  },
};

export default organizationResolver;
