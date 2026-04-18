// src/graphql/resolvers/paperResolvers/queries.ts
import Paper from "../../../models/Paper";
import User from "../../../models/User";
import mongoose from "mongoose";

const transformUser = (user: any) => {
  if (!user) return null;
  return {
    id: user._id?.toString() || user.id,
    name:
      user.personalInfo?.fullName ||
      user.personalInfo?.username ||
      user.email?.split("@")[0] ||
      "Unknown",
    email: user.personalInfo?.email || user.email,
  };
};

const transformAnnotation = (annotation: any) => {
  if (!annotation) return null;
  return {
    id: annotation._id?.toString() || annotation.id,
    page: annotation.page,
    rect: annotation.rect,
    title: annotation.title,
    text: annotation.text,
    author: annotation.author,
    reactions: annotation.reactions || [],
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  };
};

const transformRegistration = (registration: any) => {
  if (!registration) return null;
  return {
    id: registration.id,
    sessionId: registration.sessionId,
    userId: registration.userId,
    name: registration.name,
    emailAddress: registration.emailAddress,
    email: registration.email,
    courseTaken: registration.courseTaken,
    level: registration.level,
    registeredAt: registration.registeredAt,
    responses: registration.responses,
    status: registration.status,
    approvalToken: registration.approvalToken,
    registeredVia: registration.registeredVia,
    approvedAt: registration.approvedAt,
    rejectedAt: registration.rejectedAt,
  };
};

const paperQueries = {
  async getPaper(_: any, { id }: { id: string }) {
    try {
      const paper = await Paper.findById(id).lean();
      if (!paper) throw new Error("Paper not found");

      return {
        id: paper._id.toString(),
        title: paper.title,
        objective: paper.objective,
        sessionId: paper.sessionId,
        createdBy: await transformUser(
          await User.findById(paper.createdBy).lean(),
        ),
        registrations: (paper.registrations || []).map(transformRegistration),
        participants: (paper.registrations || [])
          .filter((r: any) => r.status === "APPROVED")
          .map(transformRegistration),
        waitingList: (paper.registrations || [])
          .filter((r: any) => r.status === "WAITING")
          .map(transformRegistration),
        pending: (paper.registrations || [])
          .filter((r: any) => r.status === "PENDING")
          .map(transformRegistration),
        qrCodeUrl: paper.qrCodeUrl || "",
        participantCount: (paper.registrations || []).filter(
          (r: any) => r.status === "APPROVED",
        ).length,
        availableSpots: paper.maxParticipants
          ? Math.max(
              0,
              paper.maxParticipants -
                (paper.registrations || []).filter(
                  (r: any) => r.status === "APPROVED",
                ).length,
            )
          : null,
        isFull: paper.maxParticipants
          ? (paper.registrations || []).filter(
              (r: any) => r.status === "APPROVED",
            ).length >= paper.maxParticipants
          : false,
        maxParticipants: paper.maxParticipants,
        isSessionOpen: paper.isSessionOpen || false,
        annotations: [],
        annotationCount: 0,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      };
    } catch (error) {
      console.error("Error in getPaper:", error);
      throw new Error("Failed to fetch paper");
    }
  },

  async getPapers() {
    try {
      const papers = await Paper.find().sort({ createdAt: -1 }).lean();
      return papers.map((paper) => ({
        id: paper._id.toString(),
        title: paper.title,
        objective: paper.objective,
        sessionId: paper.sessionId,
        createdBy: { id: paper.createdBy.toString(), name: "User", email: "" },
        registrations: [],
        participants: [],
        waitingList: [],
        pending: [],
        qrCodeUrl: paper.qrCodeUrl || "",
        participantCount: 0,
        availableSpots: paper.maxParticipants || null,
        isFull: false,
        maxParticipants: paper.maxParticipants,
        isSessionOpen: paper.isSessionOpen || false,
        annotations: [],
        annotationCount: 0,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      }));
    } catch (error) {
      console.error("Error in getPapers:", error);
      throw new Error("Failed to fetch papers");
    }
  },
  async getMostRecentPapers(_: any, { id }: { id: string }) {
    try {
      const papers = await Paper.find({ createdBy: id })
        .sort({ createdAt: -1 }) // most recent first
        .limit(4)
        .lean();

      if (!papers || papers.length === 0) return [];

      return papers.map((paper) => ({
        id: paper._id.toString(),
        title: paper.title,
        objective: paper.objective,
        sessionId: paper.sessionId,

        createdBy: {
          id: paper.createdBy.toString(),
          name: "User",
          email: "",
        },

        // keep consistent with schema
        registrations: [],
        participants: [],
        waitingList: [],
        pending: [],
        url: paper.url,

        qrCodeUrl: paper.qrCodeUrl || "",

        participantCount: 0,
        availableSpots: paper.maxParticipants || null,
        isFull: false,

        maxParticipants: paper.maxParticipants,
        isSessionOpen: paper.isSessionOpen || false,

        annotations: [],
        annotationCount: 0,

        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      }));
    } catch (error) {
      console.error("Error in getMostRecentPapers:", error);
      throw new Error("Failed to fetch most recent papers");
    }
  },
  async getPaperBySession(_: any, { sessionId }: { sessionId: string }) {
    try {
      console.log("========== getPaperBySession Debug ==========");
      console.log("1. Received sessionId:", sessionId);
      console.log("2. sessionId type:", typeof sessionId);
      console.log("3. sessionId length:", sessionId?.length);

      // Validate sessionId
      if (!sessionId) {
        console.error("SessionId is missing or empty");
        throw new Error("SessionId is required");
      }

      // Check database connection
      console.log("4. Checking database connection...");
      const dbState = mongoose.connection.readyState;
      console.log("5. MongoDB connection state:", dbState); // 1 = connected

      // First, check if any papers exist at all
      const totalPapers = await Paper.countDocuments();
      console.log("6. Total papers in database:", totalPapers);

      if (totalPapers === 0) {
        console.log(
          "No papers found in database. Please create a paper first.",
        );
        throw new Error(
          "No papers exist in the database. Please create a paper first.",
        );
      }

      // List all sessionIds for debugging
      const allPapers = await Paper.find(
        {},
        { sessionId: 1, title: 1, _id: 1 },
      ).lean();
      console.log(
        "7. All available papers:",
        JSON.stringify(allPapers, null, 2),
      );

      // Try to find the paper
      console.log("8. Searching for paper with sessionId:", sessionId);
      const paper = await Paper.findOne({ sessionId })
        .populate("createdBy")
        .lean();

      if (!paper) {
        console.error(`9. Paper NOT found with sessionId: ${sessionId}`);
        console.log(
          "10. Available sessionIds:",
          allPapers.map((p) => p.sessionId),
        );
        throw new Error(
          `Paper not found with sessionId: ${sessionId}. Available sessionIds: ${allPapers.map((p) => p.sessionId).join(", ")}`,
        );
      }

      console.log("11. Paper found:", paper.title);
      console.log("12. Paper sessionId:", paper.sessionId);
      console.log("13. Paper createdBy:", paper.createdBy);

      // Process registrations
      const approved = (paper.registrations || []).filter(
        (r: any) => r.status === "APPROVED",
      );

      const waiting = (paper.registrations || []).filter(
        (r: any) => r.status === "WAITING",
      );

      const pending = (paper.registrations || []).filter(
        (r: any) => r.status === "PENDING",
      );

      console.log(
        "14. Registration counts - Approved:",
        approved.length,
        "Waiting:",
        waiting.length,
        "Pending:",
        pending.length,
      );

      const result = {
        id: paper._id.toString(),
        title: paper.title,
        objective: paper.objective,
        sessionId: paper.sessionId,
        url: paper.url || "",
        qrCodeUrl: paper.qrCodeUrl || "",
        sessionStartTime: paper.sessionStartTime,
        sessionEndTime: paper.sessionEndTime,
        maxParticipants: paper.maxParticipants,
        isSessionOpen: paper.isSessionOpen || false,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
        createdBy: paper.createdBy
          ? {
              id: (paper.createdBy as any)._id.toString(),
              personalInfo: {
                fullName: (paper.createdBy as any).personalInfo?.fullName || "",
                email: (paper.createdBy as any).personalInfo?.email || "",
              },
            }
          : null,
      };

      console.log("15. Successfully returning paper data");
      console.log("==========================================");

      return result || {};
    } catch (error) {
      console.error("========== Error in getPaperBySession ==========");

      // Type-safe error handling
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Error name:", error.name);
      } else {
        console.error("Unknown error:", error);
      }

      console.error("================================================");

      // Throw a more specific error message
      if (error instanceof Error) {
        throw new Error(`Failed to fetch paper: ${error.message}`);
      } else {
        throw new Error("Failed to fetch paper: An unknown error occurred");
      }
    }
  },

  async checkPaperRegistrationStatus(
    _: any,
    { paperId, email }: { paperId: string; email: string },
  ) {
    try {
      const paper = await Paper.findById(paperId).lean();
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

      const registration = (paper.registrations || []).find(
        (r: any) => r.emailAddress === email || r.email === email,
      );

      if (!registration) {
        return {
          success: false,
          message: "No registration found",
          registrationId: null,
          status: null,
          approvalToken: null,
          paperId: paper._id.toString(),
          sessionId: paper.sessionId,
        };
      }

      return {
        success: true,
        message: `Registration status: ${registration.status}`,
        registrationId: registration.id,
        status: registration.status,
        approvalToken: registration.approvalToken,
        paperId: paper._id.toString(),
        sessionId: paper.sessionId,
      };
    } catch (error) {
      console.error("Error checking registration status:", error);
      throw new Error("Failed to check registration status");
    }
  },
};

export default paperQueries;
