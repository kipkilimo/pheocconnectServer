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
     INCIDENT LIST (FILTERED WITH PAGINATION)
    ============================================ */

    async incidents(_, { filter, limit, offset }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const filterQuery: any = {};

      // Apply filters
      if (filter) {
        if (filter.status) {
          filterQuery.status = filter.status;
        }
        if (filter.alertLevel) {
          filterQuery.alertLevel = filter.alertLevel;
        }
        if (filter.diseaseId) {
          if (!isValidObjectId(filter.diseaseId)) {
            throw new Error("Invalid disease ID in filter");
          }
          filterQuery.diseaseId = filter.diseaseId;
        }
        if (filter.eocId) {
          if (!isValidObjectId(filter.eocId)) {
            throw new Error("Invalid EOC ID in filter");
          }
          filterQuery.eocId = filter.eocId;
        }
      }

      // Build query with pagination
      let query = IncidentModel.find(filterQuery).sort({ createdAt: -1 });

      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      if (offset && offset > 0) {
        query = query.skip(offset);
      }

      const incidents = await query.lean();

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
     REPORT INCIDENT (ALIGNED WITH NEW INPUT)
    ============================================ */

    async reportIncident(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const { title, diseaseId, eocId, location, alertLevel, cases, deaths } =
        input;

      // Validation
      if (!title || title.trim().length === 0) {
        throw new Error("Title is required");
      }

      if (!location || location.trim().length === 0) {
        throw new Error("Location is required");
      }

      if (!isValidObjectId(eocId)) {
        throw new Error("Invalid EOC ID");
      }

      if (diseaseId && !isValidObjectId(diseaseId)) {
        throw new Error("Invalid disease ID");
      }

      // Validate alertLevel enum
      const validAlertLevels = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
      if (alertLevel && !validAlertLevels.includes(alertLevel)) {
        throw new Error(
          `Invalid alert level. Must be one of: ${validAlertLevels.join(", ")}`,
        );
      }

      // Create incident with all fields
      const incident = await IncidentModel.create({
        title: title.trim(),
        diseaseId: diseaseId || null,
        eocId,
        location: location.trim(),
        status: "ACTIVE", // Default status for new incidents
        alertLevel: alertLevel || "LOW",
        cases: cases || 0,
        deaths: deaths || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      // Validate status enum
      const validStatuses = [
        "ACTIVE",
        "RESOLVED",
        "INVESTIGATING",
        "MONITORING",
        "CLOSED",
      ];
      if (!validStatuses.includes(status)) {
        throw new Error(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        );
      }

      const incident = await IncidentModel.findById(id);
      if (!incident) throw new Error("Incident not found");

      incident.status = status;
      incident.updatedAt = String(new Date());

      await incident.save();

      return toId(incident.toObject());
    },
  },

  /* ============================================
   TYPE RESOLVERS (if needed for custom fields)
  ============================================ */
  Incident: {
    // Add any custom field resolvers here
    // For example, if you need to resolve location from coordinates
    // location: (parent) => parent.location,
  },
};

export default incidentResolver;
