import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";
import {
  DiseaseModel,
  CaseModel,
  SurveillanceAlertModel,
} from "../../database/models/Surveillance";

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);
const toId = (doc: any) => ({ ...doc, id: doc._id.toString() });

export const surveillanceResolvers: IResolvers = {
  Query: {
    // Diseases
    async diseases(_, { filter, limit, offset }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const filterQuery: any = {};
      if (filter?.category) filterQuery.category = filter.category;
      if (filter?.notifiable !== undefined)
        filterQuery.notifiable = filter.notifiable;
      if (filter?.search)
        filterQuery.name = { $regex: filter.search, $options: "i" };

      let query = DiseaseModel.find(filterQuery).sort({ name: 1 });
      if (limit) query = query.limit(limit);
      if (offset) query = query.skip(offset);

      return (await query.lean()).map(toId);
    },

    async disease(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid disease ID");

      const disease = await DiseaseModel.findById(id).lean();
      if (!disease) throw new Error("Disease not found");
      return toId(disease);
    },

    // Cases
    async cases(_, { incidentId, classification, limit, offset }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(incidentId)) throw new Error("Invalid incident ID");

      const filterQuery: any = { incidentId };
      if (classification) filterQuery.classification = classification;

      let query = CaseModel.find(filterQuery).sort({ reportedAt: -1 });
      if (limit) query = query.limit(limit);
      if (offset) query = query.skip(offset);

      return (await query.lean()).map(toId);
    },

    async case(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid case ID");

      const caseDoc = await CaseModel.findById(id).lean();
      if (!caseDoc) throw new Error("Case not found");
      return toId(caseDoc);
    },

    // Surveillance Alerts
    async surveillanceAlerts(_, { filter, limit, offset }, context) {
      if (!context.user) throw new Error("Not authenticated");

      const filterQuery: any = {};
      if (filter?.severity) filterQuery.severity = filter.severity;
      if (filter?.status) filterQuery.status = filter.status;
      if (filter?.diseaseId) {
        if (!isValidObjectId(filter.diseaseId))
          throw new Error("Invalid disease ID");
        filterQuery.diseaseId = filter.diseaseId;
      }
      if (filter?.incidentId) {
        if (!isValidObjectId(filter.incidentId))
          throw new Error("Invalid incident ID");
        filterQuery.incidentId = filter.incidentId;
      }
      if (filter?.fromDate || filter?.toDate) {
        filterQuery.detectedAt = {};
        if (filter.fromDate)
          filterQuery.detectedAt.$gte = new Date(filter.fromDate);
        if (filter.toDate)
          filterQuery.detectedAt.$lte = new Date(filter.toDate);
      }

      let query = SurveillanceAlertModel.find(filterQuery).sort({
        detectedAt: -1,
      });
      if (limit) query = query.limit(limit);
      if (offset) query = query.skip(offset);

      return (await query.lean()).map(toId);
    },

    async surveillanceAlert(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid alert ID");

      const alert = await SurveillanceAlertModel.findById(id).lean();
      if (!alert) throw new Error("Surveillance alert not found");
      return toId(alert);
    },

    // Surveillance Summary
    async surveillanceSummary(_, { incidentId }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(incidentId)) throw new Error("Invalid incident ID");

      const cases = await CaseModel.find({ incidentId }).lean();
      const totalCases = cases.length;
      const confirmedCases = cases.filter(
        (c: any) => c.classification === "CONFIRMED",
      ).length;
      const probableCases = cases.filter(
        (c: any) => c.classification === "PROBABLE",
      ).length;
      const suspectedCases = cases.filter(
        (c: any) => c.classification === "SUSPECTED",
      ).length;

      const deaths = cases.filter((c: any) => c.outcome === "DECEASED").length;
      const recovered = cases.filter(
        (c: any) => c.outcome === "RECOVERED",
      ).length;
      const activeCases = cases.filter(
        (c: any) =>
          c.outcome === "UNDER_TREATMENT" ||
          c.outcome === "HOSPITALIZED" ||
          !c.outcome,
      ).length;

      const alerts = await SurveillanceAlertModel.find({
        incidentId,
        status: { $ne: "RESOLVED" },
      }).lean();
      const alertsBySeverity = {
        LOW: alerts.filter((a: any) => a.severity === "LOW").length,
        MEDIUM: alerts.filter((a: any) => a.severity === "MEDIUM").length,
        HIGH: alerts.filter((a: any) => a.severity === "HIGH").length,
        CRITICAL: alerts.filter((a: any) => a.severity === "CRITICAL").length,
      };

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentAlerts = await SurveillanceAlertModel.find({
        incidentId,
        detectedAt: { $gte: sevenDaysAgo },
      })
        .sort({ detectedAt: -1 })
        .limit(5)
        .lean();

      return {
        incidentId,
        totalCases,
        confirmedCases,
        probableCases,
        suspectedCases,
        deaths,
        recovered,
        activeCases,
        alertsBySeverity,
        recentAlerts: recentAlerts.map(toId),
        caseClassificationBreakdown: {
          SUSPECTED: suspectedCases,
          PROBABLE: probableCases,
          CONFIRMED: confirmedCases,
          NOT_A_CASE: cases.filter(
            (c: any) => c.classification === "NOT_A_CASE",
          ).length,
        },
      };
    },
  },

  Mutation: {
    // Cases
    async addCase(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");
      const {
        incidentId,
        classification,
        patientAge,
        patientSex,
        location,
        symptoms,
        outcome,
      } = input;

      if (!isValidObjectId(incidentId)) throw new Error("Invalid incident ID");
      const validClassifications = [
        "SUSPECTED",
        "PROBABLE",
        "CONFIRMED",
        "NOT_A_CASE",
      ];
      if (!validClassifications.includes(classification))
        throw new Error("Invalid classification");

      const newCase = await CaseModel.create({
        incidentId,
        classification,
        patientAge: patientAge ?? null,
        patientSex: patientSex ?? null,
        location: location ?? null,
        symptoms: symptoms ?? [],
        outcome: outcome ?? null,
        reportedAt: new Date(),
        createdBy: context.user.id,
      });
      return toId(newCase);
    },

    async updateCase(_, { id, input }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid case ID");

      const existingCase = await CaseModel.findById(id);
      if (!existingCase) throw new Error("Case not found");

      if (input.classification)
        existingCase.classification = input.classification;
      if (input.patientAge !== undefined)
        existingCase.patientAge = input.patientAge;
      if (input.patientSex) existingCase.patientSex = input.patientSex;
      if (input.location) existingCase.location = input.location;
      if (input.symptoms) existingCase.symptoms = input.symptoms;
      if (input.outcome) existingCase.outcome = input.outcome;
      existingCase.updatedAt = new Date();
      await existingCase.save();

      return toId(existingCase.toObject());
    },

    async deleteCase(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!context.user.roles?.includes("ADMIN"))
        throw new Error("Not authorized");
      if (!isValidObjectId(id)) throw new Error("Invalid case ID");

      const result = await CaseModel.findByIdAndDelete(id);
      if (!result) throw new Error("Case not found");
      return true;
    },

    // Diseases
    async createDisease(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!context.user.roles?.includes("ADMIN"))
        throw new Error("Not authorized");

      const { name, category, notifiable, symptoms, incubationPeriod } = input;
      if (!name?.trim()) throw new Error("Disease name is required");

      const existing = await DiseaseModel.findOne({ name: name.trim() });
      if (existing) throw new Error("Disease already exists");

      const disease = await DiseaseModel.create({
        name: name.trim(),
        category: category || null,
        notifiable: notifiable ?? true,
        symptoms: symptoms || [],
        incubationPeriod: incubationPeriod || null,
      });
      return toId(disease);
    },

    async updateDisease(_, { id, input }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!context.user.roles?.includes("ADMIN"))
        throw new Error("Not authorized");
      if (!isValidObjectId(id)) throw new Error("Invalid disease ID");

      const disease = await DiseaseModel.findById(id);
      if (!disease) throw new Error("Disease not found");

      if (input.name) disease.name = input.name;
      if (input.category !== undefined) disease.category = input.category;
      if (input.notifiable !== undefined) disease.notifiable = input.notifiable;
      if (input.symptoms) disease.symptoms = input.symptoms;
      if (input.incubationPeriod !== undefined)
        disease.incubationPeriod = input.incubationPeriod;
      disease.updatedAt = new Date();
      await disease.save();

      return toId(disease.toObject());
    },

    // Surveillance Alerts
    async createSurveillanceAlert(_, { input }, context) {
      if (!context.user) throw new Error("Not authenticated");
      const { title, description, severity, location, diseaseId, triggeredBy } =
        input;

      if (!title?.trim()) throw new Error("Alert title is required");
      const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      if (!validSeverities.includes(severity))
        throw new Error("Invalid severity level");
      if (diseaseId && !isValidObjectId(diseaseId))
        throw new Error("Invalid disease ID");

      const alert = await SurveillanceAlertModel.create({
        title: title.trim(),
        description: description || null,
        severity,
        status: "NEW",
        location: location || null,
        diseaseId: diseaseId || null,
        triggeredBy: triggeredBy || null,
        detectedAt: new Date(),
        createdBy: context.user.id,
      });
      return toId(alert);
    },

    async acknowledgeAlert(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid alert ID");

      const alert = await SurveillanceAlertModel.findById(id);
      if (!alert) throw new Error("Alert not found");

      alert.status = "ACKNOWLEDGED";
      alert.acknowledgedAt = new Date();
      alert.updatedAt = new Date();
      alert.acknowledgedBy = context.user.id;
      await alert.save();

      return toId(alert.toObject());
    },

    async resolveAlert(_, { id }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(id)) throw new Error("Invalid alert ID");

      const alert = await SurveillanceAlertModel.findById(id);
      if (!alert) throw new Error("Alert not found");

      alert.status = "RESOLVED";
      alert.resolvedAt = new Date();
      alert.updatedAt = new Date();
      alert.resolvedBy = context.user.id;
      await alert.save();

      return toId(alert.toObject());
    },

    async linkAlertToIncident(_, { alertId, incidentId }, context) {
      if (!context.user) throw new Error("Not authenticated");
      if (!isValidObjectId(alertId)) throw new Error("Invalid alert ID");
      if (!isValidObjectId(incidentId)) throw new Error("Invalid incident ID");

      const alert = await SurveillanceAlertModel.findById(alertId);
      if (!alert) throw new Error("Alert not found");

      alert.incidentId = incidentId;
      alert.status = "INVESTIGATING";
      alert.updatedAt = new Date();
      await alert.save();

      return toId(alert.toObject());
    },
  },
};
