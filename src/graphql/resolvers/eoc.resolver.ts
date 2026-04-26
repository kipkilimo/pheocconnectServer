import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import EOCModel from "../../database/models/Eoc";
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
 GIS HELPERS (Haversine Distance)
============================================ */

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
};

/* ============================================
 RESOLVER
============================================ */

export const eocResolver: IResolvers = {
  Query: {
    /* ============================================
     ALL EOCS
    ============================================ */

    // In your EOC resolver
    async eocs(_, { limit, offset, county, alertLevel }) {
      const filter: any = {};
      if (county) filter.county = county;
      if (alertLevel) filter.alertLevel = alertLevel;

      let query = EOCModel.find(filter);
      if (limit) query = query.limit(limit);
      if (offset) query = query.skip(offset);

      const eocs = await query.lean();
      return eocs.map(toId);
    },

    /* ============================================
     SINGLE EOC
    ============================================ */

    async eoc(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid EOC ID");
      }

      const eoc = await EOCModel.findById(id).lean();
      if (!eoc) throw new Error("EOC not found");

      return toId(eoc);
    },

    /* ============================================
     ROOT EOCS (NO PARENT)
    ============================================ */

    async rootEOCs(_, __, context) {
      if (!context.user) throw new Error("Not authenticated");

      const roots = await EOCModel.find({
        $or: [{ parentId: null }, { parentId: { $exists: false } }],
      }).lean();

      return roots.map(toId);
    },

    /* ============================================
     CHILD EOCS
    ============================================ */

    async childEOCs(_, { parentId }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(parentId)) {
        throw new Error("Invalid parent ID");
      }

      const children = await EOCModel.find({ parentId }).lean();
      return children.map(toId);
    },

    /* ============================================
     PEER EOCS (LATERAL COORDINATION)
    ============================================ */

    async peerEOCs(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");

      if (!isValidObjectId(id)) {
        throw new Error("Invalid EOC ID");
      }

      const current = await EOCModel.findById(id).lean();
      if (!current) throw new Error("EOC not found");

      const peers = await EOCModel.find({
        level: current.level,
        _id: { $ne: id },
      }).lean();

      return peers.map(toId);
    },

    /* ============================================
     GIS: NEARBY EOCS (RADIUS SEARCH)
    ============================================ */

    async eocsNear(_, { lng, lat, radiusKm }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const eocs = await EOCModel.find({
        "location.coordinates": { $exists: true },
      }).lean();

      const nearby = eocs.filter((eoc: any) => {
        const coords = eoc.location?.coordinates;
        if (!coords) return false;

        const distance = haversineKm(lat, lng, coords[1], coords[0]);
        return distance <= radiusKm;
      });

      return nearby.map(toId);
    },

    /* ============================================
     GIS: COUNTY FILTER
    ============================================ */

    async eocsInCounty(_, { county }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const eocs = await EOCModel.find({ county }).lean();
      return eocs.map(toId);
    },
  },

  /* ============================================
   FIELD RESOLVERS
  ============================================ */

  EOC: {
    /* ============================================
     PARENT (UPWARD LINK)
    ============================================ */

    async parent(parent) {
      if (!parent.parentId) return null;

      const eoc = await EOCModel.findById(parent.parentId).lean();
      return eoc ? toId(eoc) : null;
    },

    /* ============================================
     CHILDREN (DOWNWARD TREE)
    ============================================ */

    async children(parent) {
      const children = await EOCModel.find({
        parentId: parent.id,
      }).lean();

      return children.map(toId);
    },

    /* ============================================
     ACTIVE INCIDENTS
    ============================================ */

    async activeIncidents(parent) {
      const incidents = await IncidentModel.find({
        eocId: parent.id,
        status: { $ne: "CLOSED" },
      }).lean();

      return incidents.map((i) => ({
        ...i,
        id: i._id.toString(),
      }));
    },

    /* ============================================
     TOTAL INCIDENT COUNT
    ============================================ */

    async totalIncidents(parent) {
      return IncidentModel.countDocuments({
        eocId: parent.id,
      });
    },
  },
};

export default eocResolver;
