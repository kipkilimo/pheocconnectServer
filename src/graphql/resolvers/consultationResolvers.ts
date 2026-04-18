import Consultation from "../../models/Consultation";
import { IResolvers } from "@graphql-tools/utils";
import mongoose from "mongoose";

/* ============================================
 HELPERS
============================================ */

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

/* ============================================
 RESOLVER
============================================ */

export const consultationResolver: IResolvers = {
  Query: {
    async getConsultation(_, { id }) {
      if (!isValidObjectId(id)) {
        throw new Error("Invalid consultation ID");
      }

      const consultation = await Consultation.findById(id)
        .populate("createdBy")
        .lean();

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      return {
        ...consultation,
        id: consultation._id.toString(),
      };
    },
    /* ============================================
     FETCH BY SESSION ID
    ============================================ */
    async getConsultationBySessionId(_, { sessionId }) {
      if (!sessionId) {
        throw new Error("sessionId is required");
      }

      const consultation = await Consultation.findOne({ sessionId }).lean();

      if (!consultation) {
        return null;
      }

      return consultation;
    },
    async getConsultations() {
      const consultations = await Consultation.find()
        .sort({ createdAt: -1 })
        .populate("createdBy")
        .lean();

      return consultations.map((c) => ({
        ...c,
        id: c._id.toString(),
      }));
    },
  },

  Mutation: {
    /* ============================================
     CREATE / UPDATE / DELETE CONSULTATION
    ============================================ */

    async createConsultation(_, { input }) {
      const activeCount = await Consultation.countDocuments({
        createdBy: input.createdBy,
        status: { $ne: "CLOSED" },
      });

      if (activeCount >= 5) {
        throw new Error("Maximum 5 active consultations allowed");
      }

      const consultation = await Consultation.create({
        ...input,
        annotationCount: 0,
      });

      return consultation;
    },
    async registerForConsultingSession(_, { input }) {
      const { sessionId, title, studentName } = input;

      if (!sessionId) {
        throw new Error("sessionId is required");
      }

      // check if session exists
      let consultation = await Consultation.findOne({ sessionId });

      // create if not exists
      if (!consultation) {
        consultation = await Consultation.create({
          sessionId,
          title,
          studentName,
          status: "CONSULTING",
          annotationCount: 0,
        });
      }

      return consultation;
    },
    async updateConsultation(_, { id, input }) {
      if (!isValidObjectId(id)) {
        throw new Error("Invalid consultation ID");
      }

      const updated = await Consultation.findByIdAndUpdate(
        id,
        {
          ...input,
          updatedAt: new Date().toISOString(),
        },
        { new: true },
      );

      if (!updated) {
        throw new Error("Consultation not found");
      }

      return updated;
    },

    async deleteConsultation(_, { id }) {
      if (!isValidObjectId(id)) return false;

      const deleted = await Consultation.findByIdAndDelete(id);
      return !!deleted;
    },

    /* ============================================
     REVIEWER COMMENTS (REPLACED ANNOTATION)
    ============================================ */

    async addReviewerComment(_, { consultationId, input }) {
      if (!isValidObjectId(consultationId)) {
        throw new Error("Invalid consultation ID");
      }

      const consultation = await Consultation.findById(consultationId);
      if (!consultation) {
        throw new Error("Consultation not found");
      }

      const comment = {
        id: new mongoose.Types.ObjectId().toString(),
        ...input,
        createdAt: new Date().toISOString(),
      };

      consultation.annotations.push(comment as any);
      consultation.annotationCount = consultation.annotations.length;

      await consultation.save();

      return comment;
    },

    async updateReviewerComment(
      _,
      { consultationId, reviewerCommentId, input },
    ) {
      const consultation = await Consultation.findById(consultationId);

      if (!consultation) {
        throw new Error("Consultation not found");
      }

      const comment = consultation.annotations.find(
        (a: any) => a.id === reviewerCommentId,
      );

      if (!comment) {
        throw new Error("Reviewer comment not found");
      }

      Object.assign(comment, input);
      comment.updatedAt = new Date().toISOString();

      await consultation.save();

      return comment;
    },

    async deleteReviewerComment(_, { consultationId, reviewerCommentId }) {
      const consultation = await Consultation.findById(consultationId);

      if (!consultation) return false;

      const index = consultation.annotations.findIndex(
        (a: any) => a.id === reviewerCommentId,
      );

      if (index === -1) return false;

      consultation.annotations.splice(index, 1);
      consultation.annotationCount = consultation.annotations.length;

      await consultation.save();

      return true;
    },
  },
};

export default consultationResolver;
