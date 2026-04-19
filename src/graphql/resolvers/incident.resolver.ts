import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import IncidentModel from "../../database/models/Incident";

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

export const incidentResolver: IResolvers = {
  Query: {
    /* ============================================
     INCIDENT LIST (FILTERED)
    ============================================ */

    async incidents(_, { status }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      const incidents = await IncidentModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return incidents.map(toId);
    },

    /* ============================================
     SINGLE INCIDENT
    ============================================ */

    async incident(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid incident ID");
      }

      const incident = await IncidentModel.findById(id).lean();
      if (!incident) throw new Error("Incident not found");

      return toId(incident);
    },
  },

  Mutation: {
    /* ============================================
     REPORT INCIDENT
    ============================================ */

    async reportIncident(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const { title, diseaseId, eocId } = input;

      if (!title || title.trim().length === 0) {
        throw new Error("Title is required");
      }

      if (!isValidObjectId(eocId)) {
        throw new Error("Invalid EOC ID");
      }

      if (diseaseId && !isValidObjectId(diseaseId)) {
        throw new Error("Invalid disease ID");
      }

      const incident = await IncidentModel.create({
        title: title.trim(),
        diseaseId: diseaseId ?? null,
        eocId,
        status: "REPORTED",
        alertLevel: "NORMAL",
        cases: 0,
        deaths: 0,
        createdAt: new Date().toISOString(),
      });

      return toId(incident);
    },

    /* ============================================
     UPDATE INCIDENT STATUS
    ============================================ */

    async updateIncidentStatus(_, { id, status }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid incident ID");
      }

      const incident = await IncidentModel.findById(id);
      if (!incident) throw new Error("Incident not found");

      incident.status = status;
      incident.updatedAt = new Date().toISOString();

      await incident.save();

      return toId(incident.toObject());
    },
  },
};

export default incidentResolver;
