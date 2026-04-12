// resolvers/examResolvers/queries.ts
import mongoose, { Types } from "mongoose";
import Exam from "../../../models/Exam";
import User from "../../../models/User";
import { transformExam, isValidObjectId } from "./helpers";
import { LeanExam } from "./types";

const examQueries = {
  Query: {
    async getExamById(_: any, { id }: { id: string }) {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid exam ID");
      }

      const exam = await Exam.findById(id)
        .populate(["createdBy", "questions"])
        .lean<LeanExam | null>();

      if (!exam) throw new Error("Revision session not found");

      // Calculate additional fields
      const participantCount = exam.participants?.length || 0;
      const approvedRegistrationsCount =
        exam.participants?.filter((p: any) => p.status === "APPROVED").length ||
        0;
      const pendingRegistrationsCount =
        exam.examPreRegistrationDetails?.filter(
          (p: any) => p.status === "PENDING",
        ).length || 0;
      const rejectedRegistrationsCount =
        exam.examPreRegistrationDetails?.filter(
          (p: any) => p.status === "REJECTED",
        ).length || 0;

      const availableSpots = exam.maxParticipants
        ? Math.max(0, exam.maxParticipants - approvedRegistrationsCount)
        : null;

      const isFull = exam.maxParticipants
        ? approvedRegistrationsCount >= exam.maxParticipants
        : false;

      const transformedExam = transformExam(exam);

      return {
        ...transformedExam,
        participantCount,
        approvedRegistrationsCount,
        pendingRegistrationsCount,
        rejectedRegistrationsCount,
        availableSpots,
        isFull,
      };
    },

    async getExamBySessionId(_: any, { sessionId }: { sessionId: string }) {
      const exam = await Exam.findOne({ sessionId })
        .populate(["createdBy", "questions"])
        .lean<LeanExam | null>();

      if (!exam) throw new Error("Revision session not found");

      const transformedExam = transformExam(exam);

      // Calculate counts
      const approvedRegistrationsCount =
        exam.participants?.filter((p: any) => p.status === "APPROVED").length ||
        0;

      return {
        ...transformedExam,
        approvedRegistrationsCount,
        participantCount: exam.participants?.length || 0,
        availableSpots: exam.maxParticipants
          ? Math.max(0, exam.maxParticipants - approvedRegistrationsCount)
          : null,
        isFull: exam.maxParticipants
          ? approvedRegistrationsCount >= exam.maxParticipants
          : false,
      };
    },

    async getAllExams() {
      const exams = await Exam.find()
        .populate(["questions", "participants", "createdBy"])
        .sort({ createdAt: -1 })
        .lean<LeanExam[]>();

      return exams.map((exam) => {
        const transformed = transformExam(exam);
        const approvedRegistrationsCount =
          exam.participants?.filter((p: any) => p.status === "APPROVED")
            .length || 0;

        return {
          ...transformed,
          approvedRegistrationsCount,
          participantCount: exam.participants?.length || 0,
        };
      });
    },

    async getExamByAccessKey(_: any, { accessKey }: { accessKey: string }) {
      const exam = await Exam.findOne({ accessKey })
        .populate(["questions", "participants", "createdBy"])
        .lean<LeanExam | null>();

      if (!exam) throw new Error("Exam not found");

      const transformedExam = transformExam(exam);
      const approvedRegistrationsCount =
        exam.participants?.filter((p: any) => p.status === "APPROVED").length ||
        0;

      return {
        ...transformedExam,
        approvedRegistrationsCount,
        participantCount: exam.participants?.length || 0,
      };
    },

    async getParticipatingExams(_: any, { userId }: { userId: string }) {
      console.log("[getParticipatingExams] Starting with userId:", userId);

      try {
        const user = await User.findById(userId).lean();

        if (!user) {
          console.error(
            "[getParticipatingExams] User not found for userId:",
            userId,
          );
          throw new Error(`User not found with id: ${userId}`);
        }

        const scholarId = user.personalInfo?.scholarId;

        if (!scholarId) {
          console.error(
            "[getParticipatingExams] No scholarId found in personalInfo",
          );
          throw new Error(`User does not have a scholarId in personalInfo`);
        }

        const queryConditions: any = {
          $or: [
            ...(isValidObjectId(scholarId) ? [{ createdBy: scholarId }] : []),
            { "participants.userId": scholarId },
            { "examPreRegistrationDetails.email": user.personalInfo?.email },
          ],
        };

        const exams = await Exam.find(queryConditions)
          .populate(["questions", "participants", "createdBy"])
          .sort({ createdAt: -1 })
          .lean<LeanExam[]>();

        return exams.map((exam) => {
          const transformed = transformExam(exam);
          const approvedRegistrationsCount =
            exam.participants?.filter((p: any) => p.status === "APPROVED")
              .length || 0;

          return {
            ...transformed,
            approvedRegistrationsCount,
            participantCount: exam.participants?.length || 0,
          };
        });
      } catch (error: any) {
        console.error("[getParticipatingExams] Error occurred:", error);
        throw error;
      }
    },

    async getRecentQuizSessions(_: any, { userId }: { userId: string }) {
      const exams = await Exam.find({
        $or: [{ createdBy: userId }, { "participants.userId": userId }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate(["createdBy", "questions"])
        .lean<LeanExam[]>();

      return exams.map((exam) => {
        const transformed = transformExam(exam);
        return {
          ...transformed,
          participantCount: exam.participants?.length || 0,
          approvedRegistrationsCount:
            exam.participants?.filter((p: any) => p.status === "APPROVED")
              .length || 0,
        };
      });
    },

    async getRecentExamSessions(_: any, { userId }: { userId: string }) {
      const exams = await Exam.find({
        createdBy: userId,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate(["createdBy", "questions"])
        .lean<LeanExam[]>();

      return exams.map((exam) => {
        const transformed = transformExam(exam);
        return {
          ...transformed,
          participantCount: exam.participants?.length || 0,
          approvedRegistrationsCount:
            exam.participants?.filter((p: any) => p.status === "APPROVED")
              .length || 0,
          pendingRegistrationsCount:
            exam.examPreRegistrationDetails?.filter(
              (p: any) => p.status === "PENDING",
            ).length || 0,
        };
      });
    },

    async getPendingRegistrations(_: any, { examId }: { examId: string }) {
      if (!Types.ObjectId.isValid(examId)) {
        throw new Error("Invalid exam ID");
      }

      const exam = await Exam.findById(examId).lean<LeanExam | null>();
      if (!exam) throw new Error("Exam not found");

      const pendingRegistrations =
        exam.examPreRegistrationDetails?.filter(
          (reg: any) => reg.status === "PENDING",
        ) || [];

      return pendingRegistrations.map((reg: any) => ({
        id: reg.id,
        sessionId: reg.sessionId,
        userId: reg.userId,
        name: reg.name,
        emailAddress: reg.emailAddress,
        email: reg.email,
        courseTaken: reg.courseTaken,
        level: reg.level,
        registeredAt: reg.registeredAt,
        responses: reg.responses,
        status: reg.status,
        approvalToken: reg.approvalToken,
        registeredVia: reg.registeredVia,
        approvedAt: reg.approvedAt,
      }));
    },

    async checkExamRegistrationStatus(
      _: any,
      { examId, email }: { examId: string; email: string },
    ) {
      try {
        const exam = await Exam.findById(examId);
        if (!exam) {
          return {
            isRegistered: false,
            status: null,
            registeredAt: null,
            accessKey: null,
          };
        }

        const registration = exam.examPreRegistrationDetails?.find(
          (r: any) => r.email === email || r.emailAddress === email,
        );

        if (!registration) {
          return {
            isRegistered: false,
            status: null,
            registeredAt: null,
            accessKey: null,
          };
        }

        return {
          isRegistered: true,
          status: registration.status,
          registeredAt: registration.registeredAt,
          accessKey: registration.status === "APPROVED" ? exam.accessKey : null,
        };
      } catch (error) {
        console.error("Error checking registration status:", error);
        throw new Error("Failed to check registration status");
      }
    },

    async getExamWaitingList(_: any, { examId }: { examId: string }) {
      try {
        const exam = await Exam.findById(examId);
        if (!exam) throw new Error("Exam not found");

        const registrations = exam.waitingList || [];
        const totalCount = registrations.length;
        const pendingCount = registrations.filter(
          (r: any) => r.status === "PENDING",
        ).length;
        const approvedCount = registrations.filter(
          (r: any) => r.status === "APPROVED",
        ).length;
        const rejectedCount = registrations.filter(
          (r: any) => r.status === "REJECTED",
        ).length;

        return {
          registrations: registrations.map((r: any) => ({
            id: r.id,
            sessionId: r.sessionId,
            userId: r.userId,
            name: r.name,
            emailAddress: r.emailAddress,
            email: r.email,
            courseTaken: r.courseTaken,
            level: r.level,
            registeredAt: r.registeredAt,
            responses: r.responses,
            status: r.status,
            approvalToken: r.approvalToken,
            registeredVia: r.registeredVia,
            approvedAt: r.approvedAt,
          })),
          totalCount,
          pendingCount,
          approvedCount,
          rejectedCount,
        };
      } catch (error) {
        console.error("Error fetching waiting list:", error);
        throw new Error("Failed to fetch waiting list");
      }
    },

    async checkExamSessionAccess(
      _: any,
      { sessionId, email }: { sessionId: string; email: string },
    ) {
      try {
        const exam = await Exam.findOne({ sessionId });
        if (!exam) {
          return {
            hasAccess: false,
            isSessionOpen: false,
            isTimeReached: false,
            message: "Exam session not found",
            examDetails: null,
          };
        }

        const hasAccess =
          exam.participants?.some(
            (p: any) =>
              (p.email === email || p.emailAddress === email) &&
              p.status === "APPROVED",
          ) || false;

        const isSessionOpen = exam.isSessionOpen || false;

        const now = new Date();
        const examDate = new Date(exam.examDate);
        const isTimeReached = now >= examDate;

        let message = "";
        if (!hasAccess) message = "You don't have access to this exam";
        else if (!isSessionOpen) message = "Session is not open yet";
        else if (!isTimeReached) message = "Exam time hasn't started yet";
        else message = "Access granted";

        return {
          hasAccess,
          isSessionOpen,
          isTimeReached,
          message,
          examDetails: hasAccess
            ? {
                title: exam.title,
                date: exam.examDate.toISOString(),
                timeZone: exam.timeZone || "UTC",
                sessionId: exam.sessionId,
              }
            : null,
        };
      } catch (error) {
        console.error("Error checking session access:", error);
        throw new Error("Failed to check session access");
      }
    },

    async getExamSessionByInviteCode(
      _: any,
      { inviteCode }: { inviteCode: string },
    ) {
      const exam = await Exam.findOne({
        $or: [{ sessionId: inviteCode }, { accessKey: inviteCode }],
      })
        .populate(["createdBy", "questions"])
        .lean<LeanExam | null>();

      if (!exam) throw new Error("Exam session not found");

      const transformedExam = transformExam(exam);
      const approvedRegistrationsCount =
        exam.participants?.filter((p: any) => p.status === "APPROVED").length ||
        0;

      return {
        ...transformedExam,
        approvedRegistrationsCount,
        participantCount: exam.participants?.length || 0,
      };
    },
  },
};

export default examQueries;
