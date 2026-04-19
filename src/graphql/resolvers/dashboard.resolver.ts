import { IResolvers } from "@graphql-tools/utils";
import Incident from "../../database/models/Incident";
import Case from "../../database/models/Case";
import LabResult from "../../database/models/Lab";
import ResponseAction from "../../database/models/Response";
import Resource from "../../database/models/Resource";
import EOC from "../../database/models/Eoc";

/* ============================================
 HELPERS
============================================ */

const now = () => new Date().toISOString();

/* ============================================
 RESOLVER
============================================ */

export const dashboardResolver: IResolvers = {
  Query: {
    async dashboardStats(_, args, context) {
      if (!context.user) throw new Error("Not authenticated");

      const { eocId, county, organizationId } = args;

      /* ============================================
       BUILD FILTER BASE
      ============================================ */

      const eocFilter: any = {};

      if (eocId) eocFilter.eocId = eocId;
      if (county) eocFilter.county = county;
      if (organizationId) eocFilter.organizationId = organizationId;

      /* ============================================
       INCIDENT METRICS
      ============================================ */

      const totalIncidents = await Incident.countDocuments(eocFilter);

      const activeIncidents = await Incident.countDocuments({
        ...eocFilter,
        status: { $ne: "CLOSED" },
      });

      const closedIncidents = await Incident.countDocuments({
        ...eocFilter,
        status: "CLOSED",
      });

      /* ============================================
       CASE METRICS
      ============================================ */

      const totalCases = await Case.countDocuments(eocFilter);

      const suspectedCases = await Case.countDocuments({
        ...eocFilter,
        classification: "SUSPECTED",
      });

      const confirmedCases = await Case.countDocuments({
        ...eocFilter,
        classification: "CONFIRMED",
      });

      const totalDeaths = await Case.countDocuments({
        ...eocFilter,
        outcome: "DEATH",
      });

      /* ============================================
       LAB METRICS
      ============================================ */

      const pendingLabResults = await LabResult.countDocuments({
        confirmed: false,
      });

      const confirmedLabResults = await LabResult.countDocuments({
        confirmed: true,
      });

      /* ============================================
       RESPONSE METRICS
      ============================================ */

      const responseActionsPending = await ResponseAction.countDocuments({
        status: { $in: ["PENDING", "IN_PROGRESS"] },
      });

      const responseActionsCompleted = await ResponseAction.countDocuments({
        status: "COMPLETED",
      });

      /* ============================================
       LOGISTICS
      ============================================ */

      const resourcesDeployed = await Resource.countDocuments();

      const activeResources = await Resource.countDocuments({
        returnedAt: null,
      });

      /* ============================================
       EOC METRICS (GIS COMMAND LAYER)
      ============================================ */

      const activeEOCs = await EOC.countDocuments({
        alertLevel: "ACTIVATED",
      });

      const escalatedEOCs = await EOC.countDocuments({
        alertLevel: "ESCALATED",
      });

      const standbyEOCs = await EOC.countDocuments({
        alertLevel: "STANDBY",
      });

      /* ============================================
       SYSTEM STATUS (LIGHTWEIGHT HEALTH CHECK)
      ============================================ */

      const systemStatus = "OPERATIONAL";

      return {
        totalIncidents,
        activeIncidents,
        closedIncidents,

        totalCases,
        suspectedCases,
        confirmedCases,

        totalDeaths,

        pendingLabResults,
        confirmedLabResults,

        responseActionsPending,
        responseActionsCompleted,

        resourcesDeployed,
        activeResources,

        activeEOCs,
        escalatedEOCs,
        standbyEOCs,

        systemStatus,
        lastUpdated: now(),
      };
    },
  },
};

export default dashboardResolver;
