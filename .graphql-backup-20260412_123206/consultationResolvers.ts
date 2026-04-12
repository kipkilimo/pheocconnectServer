import Consultation from "../../models/Consultation";
import { IResolvers } from "@graphql-tools/utils";
import { Types } from "mongoose";

import { generateUniqueCode } from "../../utils/identifier_generator";
interface DiscussionItemInput {
  consultationId: String;
  uploadId: String;
  page: Number;
  text: String;
  x: GLfloat;
  y: GLfloat;
  width: GLfloat;
  height: GLfloat;
  author: String;
  timestamp: Date;
}
interface IConsultationInput {
  studentName: string;
  createdBy: string;
  program: string;
  level?: string;
  studyStage: string;
  status: string;
  methodology?: string;
  consultMembers?: string[];
  invoices?: any[];
  uploads?: any[];
}

interface IDiscussionInput {
  id: string;
  uploadId: string;
  data: any;
}

export const consultationResolver: IResolvers = {
  Query: {
    getConsultation: async (_, { id }: { id: string }) => {
      try {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error("Invalid consultation ID");
        }
        const consultation = await Consultation.findById(id)
          .populate("consultMembers")
          .populate("createdBy");
        if (!consultation) throw new Error("Consultation not found");
        return consultation;
      } catch (error) {
        console.error(`Error fetching consultation ${id}:`, error);
        throw new Error("Failed to fetch consultation");
      }
    },
    getConsultations: async (_, { id }) => {
      try {
        let query = {};
        let populateOptions = [
          {
            path: "consultMembers",
            select: "personalInfo role",
            model: "User",
          },
          {
            path: "createdBy",
            select: "personalInfo role",
            model: "User",
          },
          {
            path: "invoices",
            select: "amount status dueDate issuedAt",
          },
          {
            path: "uploads",
            select:
              "url description createdAt updatedAt discussion activeDiscussion",
            populate: [
              {
                path: "discussion",
                select:
                  "page title text x y width height author timestamp editedAt",
              },
            ],
          },
        ];

        if (id) {
          // Check if the user is both a member and creator of consultations
          const userConsultations = await Consultation.find({
            consultMembers: id,
            createdBy: id,
          }).lean();

          if (userConsultations.length > 0) {
            // Case 1: User is both member and creator - get all their member consultations from past 5 years
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

            query = {
              consultMembers: id,
              createdAt: { $gte: fiveYearsAgo },
            };
          } else {
            // Case 2: User is only a member - apply filters for non-closed, paid invoices, and at least 1 upload
            query = {
              consultMembers: id,
              status: { $ne: "CLOSED" },
              invoices: { $exists: true, $ne: [] },
              uploads: { $exists: true, $ne: [] },
            };
          }
        }

        const consultations = await Consultation.find(query)
          .populate(populateOptions)
          .lean();

        return consultations.map(
          ({ _id, consultMembers, createdBy, uploads, invoices, ...rest }) => ({
            id: _id.toString(),
            ...rest,
            consultMembers: consultMembers.map(({ _id, ...member }) => ({
              id: _id.toString(),
              ...member,
            })),
            createdBy: createdBy
              ? {
                  // @ts-ignore
                  id: createdBy._id.toString(),
                  ...createdBy,
                }
              : null,
            invoices: invoices.map(({ _id, ...invoice }) => ({
              id: _id.toString(),
              ...invoice,
            })),
            uploads: Array.isArray(uploads)
              ? uploads
                  .filter((upload) => upload && upload._id) // Ensure valid objects
                  .map(({ _id, discussion, ...upload }) => ({
                    // @ts-ignore
                    id: _id.toString(),
                    discussion: discussion.map(({ _id, ...d }) => ({
                      id: _id.toString(),
                      ...d,
                    })),
                    ...upload,
                  }))
              : [],
          }),
        );
      } catch (error) {
        console.error("Error fetching consultations:", error);
        throw new Error("Failed to fetch consultations");
      }
    },
  },

  Mutation: {
    createConsultation: async (_, { input }: { input: IConsultationInput }) => {
      try {
        // Validation checks in parallel
        const [unpaidInvoices, nonClosedCount, existingConsultations] =
          await Promise.all([
            Consultation.find({
              createdBy: input.createdBy,
              "invoices.status": { $ne: "PAID" },
            }).countDocuments(),
            Consultation.find({
              createdBy: input.createdBy,
              status: { $ne: "CLOSED" },
            }).countDocuments(),
            Consultation.find({
              createdBy: input.createdBy,
              status: { $ne: "CLOSED" },
            }),
          ]);

        // Business rule validations
        if (unpaidInvoices > 0) {
          throw new Error("You have unpaid invoices in existing consultations");
        }
        if (nonClosedCount >= 5) {
          throw new Error("Maximum 5 ongoing consultations allowed");
        }
        if (existingConsultations.length >= 5) {
          throw new Error("You have existing non-closed consultations");
        }

        // Ensure creator is included in members
        const consultMembers = [
          ...(input.consultMembers || []),
          input.createdBy,
        ];

        const newConsultation = await Consultation.create({
          ...input,
          consultMembers,
        });

        return newConsultation.populate(["consultMembers", "createdBy"]);
      } catch (error) {
        console.error("Error creating consultation:", error);
        throw new Error(`Failed to create consultation: ${error}`);
      }
    },

    updateConsultation: async (
      _,
      { id, studyStage }: { id: string; studyStage: string },
    ) => {
      try {
        const updated = await Consultation.findByIdAndUpdate(
          id,
          { studyStage },
          { new: true },
        ).populate("consultMembers");
        if (!updated) throw new Error("Consultation not found");
        return updated;
      } catch (error) {
        console.error(`Error updating consultation ${id}:`, error);
        throw new Error("Failed to update consultation");
      }
    },
    addConsultationDiscussion: async (
      _,
      { discussionItem }: { discussionItem: DiscussionItemInput },
    ) => {
      try {
        if (!discussionItem.text || !discussionItem.author) {
          throw new Error("Discussion must contain text and author");
        }

        const newDiscussion = {
          page: discussionItem.page,
          text: discussionItem.text,
          x: discussionItem.x,
          y: discussionItem.y,
          width: discussionItem.width,
          height: discussionItem.height,
          author: discussionItem.author,
          timestamp: new Date(discussionItem.timestamp || Date.now()),
          id: generateUniqueCode(11),
        };

        const updated = await Consultation.findOneAndUpdate(
          {
            _id: discussionItem.consultationId,
            "uploads.id": discussionItem.uploadId,
          },
          {
            $push: { "uploads.$.discussion": newDiscussion },
            $set: {
              "uploads.$.activeDiscussion": newDiscussion.id,
              updatedAt: new Date(),
            },
          },
          { new: true },
        ).populate("consultMembers");

        if (!updated) throw new Error("Consultation not found");
        return updated;
      } catch (error) {
        console.error("Error adding discussion:", error);
        throw new Error(`Failed to add discussion: ${error}`);
      }
    },

    deleteConsultation: async (_, { id }: { id: string }) => {
      try {
        const deleted = await Consultation.findByIdAndDelete(id);
        return !!deleted;
      } catch (error) {
        console.error(`Error deleting consultation ${id}:`, error);
        throw new Error("Failed to delete consultation");
      }
    },

    adminUpdateConsultation: async (
      _,
      { id, input }: { id: string; input: any },
    ) => {
      try {
        const updated = await Consultation.findByIdAndUpdate(id, input, {
          new: true,
        }).populate("consultMembers");
        if (!updated) throw new Error("Consultation not found");
        return updated;
      } catch (error) {
        console.error(`Error admin-updating consultation ${id}:`, error);
        throw new Error("Failed to update consultation");
      }
    },

    tutorUpdateStudyStage: async (
      _,
      { id, studyStage }: { id: string; studyStage: string },
    ) => {
      try {
        const updated = await Consultation.findByIdAndUpdate(
          id,
          { studyStage },
          { new: true },
        ).populate("consultMembers");
        if (!updated) throw new Error("Consultation not found");
        return updated;
      } catch (error) {
        console.error(`Error updating study stage for ${id}:`, error);
        throw new Error("Failed to update study stage");
      }
    },

    deleteAllConsultations: async () => {
      try {
        const result = await Consultation.deleteMany({});
        return { success: true, deletedCount: result.deletedCount };
      } catch (error) {
        console.error("Error deleting consultations:", error);
        throw new Error("Failed to delete consultations");
      }
    },
    migrateDiscussions: async (): Promise<{
      message: string;
      migratedCount: number;
      processedCount: number;
    }> => {
      try {
        const consultations = await Consultation.find({
          $or: [
            { "uploads.discussion": { $exists: true, $not: { $size: 0 } } },
            { "uploads.activeDiscussion": { $exists: true } },
          ],
        }).lean();

        let migratedCount = 0;
        const bulkOps: any[] = [];

        for (const consultation of consultations) {
          let needsUpdate = false;
          const uploadUpdates = consultation.uploads.map((upload: any) => {
            const update: any = {};

            if (
              upload.discussion?.some((entry: any) => typeof entry === "string")
            ) {
              update.discussion = upload.discussion.map((entry: any) => {
                if (typeof entry === "string") {
                  return {
                    id: generateUniqueCode(11),
                    page: 1,
                    text:
                      entry === "[object Object]" ? "Legacy comment" : entry,
                    author: "System",
                    timestamp: new Date(),
                  };
                }
                return {
                  id: entry.id || generateUniqueCode(11),
                  page: entry.page || 1,
                  text: entry.text,
                  x: entry.x,
                  y: entry.y,
                  width: entry.width,
                  height: entry.height,
                  author: entry.author || "System",
                  timestamp: entry.timestamp
                    ? new Date(entry.timestamp)
                    : new Date(),
                };
              });
              needsUpdate = true;
            }

            if (
              typeof upload.activeDiscussion === "string" ||
              upload.activeDiscussion
            ) {
              update.activeDiscussion =
                typeof upload.activeDiscussion === "string"
                  ? upload.activeDiscussion === ""
                    ? null
                    : generateUniqueCode(11)
                  : upload.activeDiscussion.id || generateUniqueCode(11);
              needsUpdate = true;
            }

            return update;
          });

          if (needsUpdate) {
            bulkOps.push({
              updateOne: {
                filter: { _id: consultation._id },
                update: { $set: { uploads: uploadUpdates } },
              },
            });
            migratedCount++;
          }
        }

        if (bulkOps.length > 0) {
          await Consultation.bulkWrite(bulkOps);
        }

        return {
          message: `Migrated ${migratedCount} of ${consultations.length} consultations`,
          migratedCount,
          processedCount: consultations.length,
        };
      } catch (error) {
        console.error("Migration error:", error);
        throw new Error(`Migration failed: ${error}`);
      }
    },
  },
};

export default consultationResolver;
