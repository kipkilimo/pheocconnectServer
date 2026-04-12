// resolvers/paperResolvers/queries.ts - FIXED VERSION
import Paper from "../../../models/Paper";
import User from "../../../models/User";
import mongoose from "mongoose";

const paperQueries = {
  // Get paper by ID
  async getPaper(_: any, { id }: { id: string }) {
    try {
      const paper = await Paper.findById(id)
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email",
        )
        .lean();

      if (!paper) {
        throw new Error("Paper not found");
      }

      // Calculate counts with safe access
      const participants = (paper as any).participants || [];
      const participantCount = participants.length;
      const approvedRegistrationsCount = participants.filter(
        (p: any) => p.status === "APPROVED",
      ).length;
      const pendingRegistrationsCount = participants.filter(
        (p: any) => p.status === "PENDING",
      ).length;
      const rejectedRegistrationsCount = participants.filter(
        (p: any) => p.status === "REJECTED",
      ).length;

      const availableSpots = (paper as any).maxParticipants
        ? Math.max(
            0,
            (paper as any).maxParticipants - approvedRegistrationsCount,
          )
        : null;

      const isFull = (paper as any).maxParticipants
        ? approvedRegistrationsCount >= (paper as any).maxParticipants
        : false;

      return {
        ...paper,
        participantCount,
        approvedRegistrationsCount,
        pendingRegistrationsCount,
        rejectedRegistrationsCount,
        availableSpots,
        isFull,
      };
    } catch (error) {
      console.error("Error fetching paper:", error);
      throw new Error("Failed to fetch paper");
    }
  },

  // Get all papers
  async getPapers() {
    try {
      const papers = await Paper.find()
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email",
        )
        .sort({ createdDate: -1 })
        .lean();

      // Add calculated fields to each paper
      return papers.map((paper) => {
        const participants = (paper as any).participants || [];
        return {
          ...paper,
          participantCount: participants.length,
          approvedRegistrationsCount: participants.filter(
            (p: any) => p.status === "APPROVED",
          ).length,
          pendingRegistrationsCount: participants.filter(
            (p: any) => p.status === "PENDING",
          ).length,
          rejectedRegistrationsCount: participants.filter(
            (p: any) => p.status === "REJECTED",
          ).length,
        };
      });
    } catch (error) {
      console.error("Error fetching papers:", error);
      throw new Error("Failed to fetch papers");
    }
  },

  // Get LIVE paper by accessKey
  async getLivePaper(_: any, { accessKey }: { accessKey: string }) {
    try {
      const paper = await Paper.findOne({ accessKey })
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email role",
        )
        .lean();

      if (!paper) {
        throw new Error("Paper not found");
      }

      return {
        ...paper,
        annotationCount: (paper as any).annotations?.length || 0,
      };
    } catch (error) {
      console.error("Error fetching LIVE paper:", error);
      throw new Error("Failed to fetch LIVE paper");
    }
  },

  // Get most recent papers
  async getMostRecentPapers(_: any, { limit = 10 }: { limit?: number }) {
    try {
      const papers = await Paper.find()
        .sort({ createdDate: -1 })
        .limit(limit)
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email",
        )
        .lean();

      return papers;
    } catch (error) {
      console.error("Error fetching recent papers:", error);
      throw new Error("Failed to fetch recent papers");
    }
  },

  // Get paper by sessionId
  async getPaperBySession(_: any, { sessionId }: { sessionId: string }) {
    try {
      const paper = await Paper.findOne({ sessionId })
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email",
        )
        .lean();

      if (!paper) {
        throw new Error("Paper not found");
      }

      return paper;
    } catch (error) {
      console.error("Error fetching paper by session:", error);
      throw new Error("Failed to fetch paper");
    }
  },

  // Get annotations for a paper
  async getPaperAnnotations(
    _: any,
    {
      paperId,
      page,
      limit = 50,
    }: { paperId: string; page?: number; limit?: number },
  ) {
    try {
      const paper = await Paper.findById(paperId);
      if (!paper) {
        throw new Error("Paper not found");
      }

      let annotations = (paper as any).annotations || [];

      if (page !== undefined && page !== null) {
        annotations = annotations.filter((a: any) => a.page === page);
      }

      return annotations.slice(0, limit);
    } catch (error) {
      console.error("Error fetching annotations:", error);
      throw new Error("Failed to fetch annotations");
    }
  },

  // Get current user's annotations across all papers
  async getMyPaperAnnotations(_: any, __: any, { user }: any) {
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }

      const papers = await Paper.find({
        "annotations.author.id": user.id,
      }).lean();

      const allAnnotations = papers.flatMap((paper) =>
        ((paper as any).annotations || []).filter(
          (a: any) => a.author.id === user.id,
        ),
      );

      // FIXED: Use proper date parsing with null checks
      return allAnnotations
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 100);
    } catch (error) {
      console.error("Error fetching my annotations:", error);
      throw new Error("Failed to fetch annotations");
    }
  },

  // Get pending access requests for a paper
  async getPaperPendingAccessRequests(
    _: any,
    { paperId }: { paperId: string },
    { user }: any,
  ) {
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }

      const paper = await Paper.findById(paperId);
      if (!paper) {
        throw new Error("Paper not found");
      }

      if ((paper as any).createdBy.toString() !== user.id) {
        throw new Error("Not authorized to view access requests");
      }

      return (paper as any).pendingRequests || [];
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      throw new Error("Failed to fetch pending requests");
    }
  },

  // Get approved collaborators for a paper
  async getPaperApprovedCollaborators(
    _: any,
    { paperId }: { paperId: string },
    { user }: any,
  ) {
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }

      const paper = await Paper.findById(paperId);
      if (!paper) {
        throw new Error("Paper not found");
      }

      const isCreator = (paper as any).createdBy.toString() === user.id;
      const isApproved = (paper as any).approvedCollaborators?.some(
        (c: any) => c.email === user.personalInfo?.email,
      );

      if (!isCreator && !isApproved) {
        throw new Error("Not authorized to view collaborators");
      }

      return (paper as any).approvedCollaborators || [];
    } catch (error) {
      console.error("Error fetching approved collaborators:", error);
      throw new Error("Failed to fetch approved collaborators");
    }
  },

  // Check paper access (simple boolean)
  async checkPaperAccess(
    _: any,
    { sessionId, email }: { sessionId: string; email: string },
  ) {
    try {
      const paper = await Paper.findOne({ sessionId });
      if (!paper) {
        return false;
      }

      const creator = await User.findById((paper as any).createdBy).lean();
      if (creator?.personalInfo?.email === email) {
        return true;
      }

      const isApproved = (paper as any).approvedCollaborators?.some(
        (c: any) => c.email === email,
      );

      return !!isApproved;
    } catch (error) {
      console.error("Error checking paper access:", error);
      return false;
    }
  },

  // Get paper waiting list
  async getPaperWaitingList(
    _: any,
    { paperId }: { paperId: string },
    { user }: any,
  ) {
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }

      const paper = await Paper.findById(paperId);
      if (!paper) {
        throw new Error("Paper not found");
      }

      if ((paper as any).createdBy.toString() !== user.id) {
        throw new Error("Not authorized to view waiting list");
      }

      const registrations = (paper as any).waitingList || [];
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
        registrations,
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

  // Check paper session access with detailed response
  async checkPaperSessionAccess(
    _: any,
    { sessionId, email }: { sessionId: string; email: string },
  ) {
    try {
      const paper = await Paper.findOne({ sessionId });
      if (!paper) {
        return {
          hasAccess: false,
          isSessionOpen: false,
          isTimeReached: false,
          message: "Paper session not found",
          paperDetails: null,
        };
      }

      const hasAccess =
        (paper as any).approvedCollaborators?.some(
          (c: any) => c.email === email,
        ) || false;

      const isSessionOpen = (paper as any).isSessionOpen || false;

      const now = new Date();
      const sessionStartTime = (paper as any).sessionStartTime
        ? new Date((paper as any).sessionStartTime)
        : null;
      const isTimeReached = sessionStartTime ? now >= sessionStartTime : true;

      let message = "";
      if (!hasAccess) message = "You don't have access to this paper";
      else if (!isSessionOpen) message = "Session is not open";
      else if (!isTimeReached) message = "Session hasn't started yet";
      else message = "Access granted";

      return {
        hasAccess,
        isSessionOpen,
        isTimeReached,
        message,
        paperDetails: hasAccess
          ? {
              title: (paper as any).title,
              objective: (paper as any).objective,
              sessionId: (paper as any).sessionId,
            }
          : null,
      };
    } catch (error) {
      console.error("Error checking session access:", error);
      throw new Error("Failed to check session access");
    }
  },

  // Check paper registration status
  async checkPaperRegistrationStatus(
    _: any,
    { paperId, email }: { paperId: string; email: string },
  ) {
    try {
      const paper = await Paper.findById(paperId);
      if (!paper) {
        return {
          success: false,
          message: "Paper not found",
          registrationId: null,
          status: null,
          approvalToken: null,
          paperId: null,
          sessionId: null,
        };
      }

      const registration = (paper as any).participants?.find(
        (p: any) => p.emailAddress === email || p.email === email,
      );

      if (!registration) {
        return {
          success: false,
          message: "No registration found",
          registrationId: null,
          status: null,
          approvalToken: null,
          paperId: (paper as any)._id.toString(),
          sessionId: (paper as any).sessionId,
        };
      }

      return {
        success: true,
        message: `Registration status: ${registration.status}`,
        registrationId: registration.id,
        status: registration.status,
        approvalToken: registration.approvalToken,
        paperId: (paper as any)._id.toString(),
        sessionId: (paper as any).sessionId,
      };
    } catch (error) {
      console.error("Error checking registration status:", error);
      throw new Error("Failed to check registration status");
    }
  },

  // Get paper pending registrations
  async getPaperPendingRegistrations(
    _: any,
    { paperId }: { paperId: string },
    { user }: any,
  ) {
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }

      const paper = await Paper.findById(paperId);
      if (!paper) {
        throw new Error("Paper not found");
      }

      if ((paper as any).createdBy.toString() !== user.id) {
        throw new Error("Not authorized to view registrations");
      }

      return ((paper as any).participants || []).filter(
        (p: any) => p.status === "PENDING",
      );
    } catch (error) {
      console.error("Error fetching pending registrations:", error);
      throw new Error("Failed to fetch pending registrations");
    }
  },
};

export default paperQueries;
