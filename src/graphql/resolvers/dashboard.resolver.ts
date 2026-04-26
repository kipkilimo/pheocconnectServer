import { IResolvers } from "@graphql-tools/utils";
import Incident from "../../database/models/Incident";
import {
  DiseaseModel,
  CaseModel,
  SurveillanceAlertModel,
} from "../../database/models/Surveillance";
import LabResult from "../../database/models/Lab";
import ResponseAction from "../../database/models/Response";
import Resource from "../../database/models/Resource";
import EOC from "../../database/models/Eoc";
import { getUserFromContext } from "../../utils/authGenerator";

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
      const user = getUserFromContext(context);
      if (!user) throw new Error("Not authenticated");

      const { eocId, county, organizationId } = args;

      // Build filter for EOC and Incident
      const eocFilter: any = {};
      if (eocId) eocFilter._id = eocId;
      if (county) eocFilter.county = county;
      if (organizationId) eocFilter.organizationId = organizationId;

      // Get all EOC IDs matching the filter (if any)
      let eocIds: string[] = [];
      if (Object.keys(eocFilter).length > 0) {
        const eocs = await EOC.find(eocFilter).select("_id").lean();
        eocIds = eocs.map((e) => e._id.toString());
      }

      // Build incident filter based on eocIds or direct eocId
      const incidentFilter: any = {};
      if (eocIds.length > 0) {
        incidentFilter.eocId = { $in: eocIds };
      } else if (eocId) {
        incidentFilter.eocId = eocId;
      }
      // Optionally add county/organization if Incident has those fields (adjust as needed)
      if (county) incidentFilter.county = county;
      if (organizationId) incidentFilter.organizationId = organizationId;

      /* ============================================
       INCIDENT METRICS
      ============================================ */
      const totalIncidents = await Incident.countDocuments(incidentFilter);
      const activeIncidents = await Incident.countDocuments({
        ...incidentFilter,
        status: { $ne: "CLOSED" },
      });
      const closedIncidents = await Incident.countDocuments({
        ...incidentFilter,
        status: "CLOSED",
      });

      /* ============================================
       CASE METRICS
       Cases are linked to incidents, so filter by incident IDs
      ============================================ */
      let incidentIds: string[] = [];
      if (Object.keys(incidentFilter).length > 0) {
        const incidents = await Incident.find(incidentFilter)
          .select("_id")
          .lean();
        incidentIds = incidents.map((inc) => inc._id.toString());
      }

      const caseFilter: any = {};
      if (incidentIds.length > 0) {
        caseFilter.incidentId = { $in: incidentIds };
      }

      const totalCases = await CaseModel.countDocuments(caseFilter);
      const suspectedCases = await CaseModel.countDocuments({
        ...caseFilter,
        classification: "SUSPECTED",
      });
      const confirmedCases = await CaseModel.countDocuments({
        ...caseFilter,
        classification: "CONFIRMED",
      });
      const totalDeaths = await CaseModel.countDocuments({
        ...caseFilter,
        outcome: "DECEASED", // Use correct enum value
      });

      /* ============================================
       LAB METRICS
       Assuming LabResult has incidentId or eocId – adjust as needed
       For now, count all (or filter by incidentIds if relation exists)
      ============================================ */
      const labFilter: any = {};
      if (incidentIds.length > 0) {
        labFilter.incidentId = { $in: incidentIds };
      }
      const pendingLabResults = await LabResult.countDocuments({
        ...labFilter,
        confirmed: false,
      });
      const confirmedLabResults = await LabResult.countDocuments({
        ...labFilter,
        confirmed: true,
      });

      /* ============================================
       RESPONSE METRICS
      ============================================ */
      const responseFilter: any = {};
      if (incidentIds.length > 0) {
        responseFilter.incidentId = { $in: incidentIds };
      }
      const responseActionsPending = await ResponseAction.countDocuments({
        ...responseFilter,
        status: { $in: ["PENDING", "IN_PROGRESS"] },
      });
      const responseActionsCompleted = await ResponseAction.countDocuments({
        ...responseFilter,
        status: "COMPLETED",
      });

      /* ============================================
       LOGISTICS (Resources)
      ============================================ */
      const resourceFilter: any = {};
      if (incidentIds.length > 0) {
        resourceFilter.incidentId = { $in: incidentIds };
      }
      const resourcesDeployed = await Resource.countDocuments(resourceFilter);
      const activeResources = await Resource.countDocuments({
        ...resourceFilter,
        returnedAt: null,
      });

      /* ============================================
       EOC METRICS
      ============================================ */
      const activeEOCs = await EOC.countDocuments({ alertLevel: "ACTIVATED" });
      const escalatedEOCs = await EOC.countDocuments({
        alertLevel: "ESCALATED",
      });
      const standbyEOCs = await EOC.countDocuments({ alertLevel: "STANDBY" });

      /* ============================================
       SYSTEM STATUS
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

    async recentItems(_, args, context) {
      const user = getUserFromContext(context);
      if (!user) throw new Error("Not authenticated");

      const { eocId, county, organizationId, limit = 10 } = args;

      // Build EOC filter
      const eocFilter: any = {};
      if (eocId) eocFilter._id = eocId;
      if (county) eocFilter.county = county;
      if (organizationId) eocFilter.organizationId = organizationId;

      let incidentIds: string[] = [];
      if (Object.keys(eocFilter).length > 0) {
        const eocs = await EOC.find(eocFilter).select("_id").lean();
        const eocIdList = eocs.map((e) => e._id.toString());
        const incidents = await Incident.find({ eocId: { $in: eocIdList } })
          .select("_id")
          .lean();
        incidentIds = incidents.map((inc) => inc._id.toString());
      } else {
        // If no EOC filter, get all incident IDs (or apply other filters)
        const incidents = await Incident.find({}).select("_id").lean();
        incidentIds = incidents.map((inc) => inc._id.toString());
      }

      const itemFilter: any = {};
      if (incidentIds.length > 0) {
        itemFilter.incidentId = { $in: incidentIds };
      }

      /* ============================================
       RECENT INCIDENTS (already have incidentIds)
      ============================================ */
      const incidents = await Incident.find(
        incidentIds.length > 0 ? { _id: { $in: incidentIds } } : {},
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedIncidents = incidents.map((incident: any) => ({
        id: incident._id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity || incident.priority,
        reportedAt: incident.reportedAt || incident.createdAt,
        location: incident.location || incident.address,
      }));

      /* ============================================
       RECENT CASES
      ============================================ */
      const cases = await CaseModel.find(itemFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedCases = cases.map((caseItem: any) => ({
        id: caseItem._id,
        caseId: caseItem._id.toString(),
        status: caseItem.classification, // Use classification as status
        type: caseItem.symptoms?.[0] || "Unknown",
        reportedAt: caseItem.reportedAt || caseItem.createdAt,
        patientName: `Patient ${caseItem.patientAge ? `Age ${caseItem.patientAge}` : "Unknown"}`,
      }));

      /* ============================================
       RECENT LAB RESULTS
      ============================================ */
      const labResults = await LabResult.find(itemFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedLabResults = labResults.map((lab: any) => ({
        id: lab._id,
        sampleId: lab._id.toString(),
        result: lab.confirmed ? "POSITIVE" : "NEGATIVE",
        testedAt: lab.createdAt,
        status: lab.confirmed ? "COMPLETED" : "PENDING",
      }));

      /* ============================================
       RECENT RESPONSE ACTIONS
      ============================================ */
      const responseActions = await ResponseAction.find(itemFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedResponseActions = responseActions.map((action: any) => ({
        id: action._id,
        actionType: action.type || "Unknown",
        status: action.status,
        assignedTo: action.assignedTo || "Unassigned",
        createdAt: action.createdAt,
      }));

      /* ============================================
       RECENT DEPLOYMENTS (RESOURCES)
      ============================================ */
      const deployments = await Resource.find({
        ...itemFilter,
        deployedAt: { $ne: null },
      })
        .sort({ deployedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedDeployments = deployments.map((resource: any) => ({
        id: resource._id,
        resourceType: resource.type || "Unknown",
        quantity: resource.quantity || 1,
        destination: resource.location || "Unknown",
        deployedAt: resource.deployedAt || resource.createdAt,
      }));

      return {
        incidents: formattedIncidents,
        cases: formattedCases,
        labResults: formattedLabResults,
        responseActions: formattedResponseActions,
        deployments: formattedDeployments,
      };
    },
  },
};

export default dashboardResolver;
