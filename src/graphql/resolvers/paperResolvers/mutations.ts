// resolvers/paperResolvers/mutations.ts - FIXED VERSION
import mongoose from "mongoose";
import Paper from "../../../models/Paper";
import User from "../../../models/User";
import { generateUniqueCode } from "../../../utils/identifier_generator";
import generateAccessKey from "../../../utils/accessKeyUtility";
import {
  generateQRCodeDataUrl,
  generatePaperQRCodePDF,
  sendPaperCreatedEmailWithAttachment,
  sendPaperAccessGrantedEmail,
  sendAccessRequestNotification,
  fileExists,
} from "./utils";
import { promises as fsPromises } from "fs";

const paperMutations = {
  // Paper CRUD
  async createPaper(
    _: any,
    { createdBy, title, objective, url, maxParticipants }: any,
  ) {
    try {
      const accessKeyStr = generateAccessKey();
      const sessionId = generateUniqueCode(12);
      const joinUrl = `${process.env.FRONTEND_URL || "http://localhost:8000"}/join-paper/${sessionId}`;
      const qrCodeUrl = await generateQRCodeDataUrl(joinUrl);
      const pdfPath = await generatePaperQRCodePDF({
        title,
        sessionId,
        accessKey: accessKeyStr,
        createdDate: new Date(),
        joinUrl,
      });

      const paper = new Paper({
        title,
        objective: objective || "",
        url: url || "",
        createdBy,
        sessionId,
        accessKey: accessKeyStr,
        createdDate: new Date().toISOString(),
        status: "DRAFT",
        maxParticipants: maxParticipants || 100,
        annotations: [],
        annotationCount: 0,
        liveSession: { isActive: false },
        pendingRequests: [],
        approvedCollaborators: [],
        participants: [],
        waitingList: [],
        isSessionOpen: false,
        qrCodeUrl,
        qrCodePdfPath: pdfPath,
        joinUrl,
      });

      await paper.save();

      const creator = await User.findById(createdBy).lean();
      if (creator?.personalInfo?.email) {
        await sendPaperCreatedEmailWithAttachment({
          email: creator.personalInfo.email,
          name:
            creator.personalInfo?.fullName ||
            creator.personalInfo?.username ||
            "User",
          paperTitle: title,
          sessionId,
          accessKey: accessKeyStr,
          joinUrl,
          qrCodeUrl,
          pdfPath,
          createdDate: new Date(),
        });
      }

      const populatedPaper = await Paper.findById(paper._id)
        .populate(
          "createdBy",
          "personalInfo.fullName personalInfo.username personalInfo.email",
        )
        .lean();

      return {
        paper: { ...populatedPaper, annotationCount: 0 },
        qrCodeUrl,
        qrCodePdfPath: pdfPath,
        joinUrl,
        sessionId,
        accessKey: accessKeyStr,
      };
    } catch (error) {
      console.error("Error creating paper:", error);
      throw new Error("Failed to create paper");
    }
  },

  async updatePaper(
    _: any,
    { id, title, objective, createdDate, maxParticipants }: any,
  ) {
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (objective !== undefined) updateData.objective = objective;
    if (createdDate !== undefined) updateData.createdDate = createdDate;
    if (maxParticipants !== undefined)
      updateData.maxParticipants = maxParticipants;

    const paper = await Paper.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    )
      .populate(
        "createdBy",
        "personalInfo.fullName personalInfo.username personalInfo.email",
      )
      .lean();

    if (!paper) throw new Error("Paper not found");
    return paper;
  },

  async deletePaper(_: any, { id }: { id: string }) {
    const paper = await Paper.findByIdAndDelete(id);
    if (!paper) throw new Error("Paper not found");

    if (paper.qrCodePdfPath && (await fileExists(paper.qrCodePdfPath))) {
      await fsPromises.unlink(paper.qrCodePdfPath).catch(console.error);
    }
    return paper;
  },

  // Access Request Mutations
  async requestPaperAccess(_: any, { sessionId, email, name, reason }: any) {
    const paper = await Paper.findOne({ sessionId });
    if (!paper) throw new Error("Paper not found");

    const isApproved = paper.approvedCollaborators?.some(
      (c: any) => c.email === email,
    );
    if (isApproved) throw new Error("You already have access to this paper");

    const isPending = paper.pendingRequests?.some(
      (r: any) => r.email === email && r.status === "PENDING",
    );
    if (isPending) throw new Error("Access request already pending");

    const requestId = new mongoose.Types.ObjectId().toString();
    paper.pendingRequests!.push({
      id: requestId,
      email,
      name: name || email.split("@")[0],
      reason: reason || "",
      requestedAt: new Date().toISOString(),
      status: "PENDING",
    });
    await paper.save();

    const creator = await User.findById(paper.createdBy).lean();
    if (creator?.personalInfo?.email) {
      await sendAccessRequestNotification({
        creatorEmail: creator.personalInfo.email,
        creatorName: creator.personalInfo?.fullName || "Paper Creator",
        requesterName: name || email.split("@")[0],
        requesterEmail: email,
        paperTitle: paper.title,
        paperId: paper._id.toString(),
        requestId,
      });
    }

    return {
      success: true,
      message: "Access request sent successfully",
      requestId,
      status: "PENDING",
    };
  },

  async approvePaperAccess(_: any, { paperId, requestId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can approve access");
    }

    const request = paper.pendingRequests?.find((r: any) => r.id === requestId);
    if (!request) throw new Error("Access request not found");
    if (request.status !== "PENDING") {
      throw new Error(`Request already ${request.status.toLowerCase()}`);
    }

    request.status = "APPROVED";
    request.approvedAt = new Date().toISOString();
    paper.approvedCollaborators!.push({
      email: request.email,
      name: request.name,
      approvedAt: new Date().toISOString(),
      approvedBy: new mongoose.Types.ObjectId(user.id),
    });
    paper.pendingRequests = paper.pendingRequests?.filter(
      (r: any) => r.id !== requestId,
    );
    await paper.save();

    const joinUrl = `${process.env.FRONTEND_URL || "http://localhost:8000"}/join-paper/${paper.sessionId}?email=${encodeURIComponent(request.email)}`;
    await sendPaperAccessGrantedEmail({
      email: request.email,
      name: request.name,
      paperTitle: paper.title,
      sessionId: paper?.sessionId || "",
      accessKey: paper?.accessKey || "",
      joinUrl,
      grantedBy:
        user.personalInfo?.fullName ||
        user.personalInfo?.username ||
        "The paper owner",
    });

    return {
      success: true,
      message: "Access granted successfully",
      requestId,
      status: "APPROVED",
    };
  },

  async denyPaperAccess(_: any, { paperId, requestId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can deny access");
    }

    const request = paper.pendingRequests?.find((r: any) => r.id === requestId);
    if (!request) throw new Error("Access request not found");
    if (request.status !== "PENDING") {
      throw new Error(`Request already ${request.status.toLowerCase()}`);
    }

    request.status = "DENIED";
    request.deniedAt = new Date().toISOString();
    paper.pendingRequests = paper.pendingRequests?.filter(
      (r: any) => r.id !== requestId,
    );
    await paper.save();

    return {
      success: true,
      message: "Access request denied",
      requestId,
      status: "REJECTED",
    };
  },

  // Process registrations (approve/reject multiple)
  async processPaperRegistrations(
    _: any,
    { paperId, registrationIds, action }: any,
    { user }: any,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can process registrations");
    }

    const actionUpper = action.toUpperCase();
    if (actionUpper !== "APPROVE" && actionUpper !== "REJECT") {
      throw new Error("Action must be either 'approve' or 'reject'");
    }

    let processedCount = 0;
    let approvedCount =
      paper.participants?.filter((p: any) => p.status === "APPROVED").length ||
      0;

    for (const regId of registrationIds) {
      const registration = paper.participants?.find((p: any) => p.id === regId);
      if (!registration || registration.status !== "PENDING") continue;

      if (actionUpper === "APPROVE") {
        if (paper.maxParticipants && approvedCount >= paper.maxParticipants) {
          // Move to waiting list
          if (!paper.waitingList) paper.waitingList = [];
          paper.waitingList.push({
            id: new mongoose.Types.ObjectId().toString(),
            sessionId: paper.sessionId!,
            email: registration.emailAddress || registration.email || "",
            name: registration.name,
            courseTaken: registration.courseTaken,
            level: registration.level,
            registeredAt: registration.registeredAt,
            status: "PENDING" as any, // Type assertion for enum
            approvalToken: registration.approvalToken,
            registeredVia: registration.registeredVia,
          });
          paper.participants = paper.participants?.filter(
            (p: any) => p.id !== regId,
          );
        } else {
          registration.status = "APPROVED" as any;
          registration.approvedAt = new Date().toISOString();
          approvedCount++;
          processedCount++;
        }
      } else if (actionUpper === "REJECT") {
        registration.status = "REJECTED" as any;
        processedCount++;
      }
    }

    await paper.save();
    const actionLowered = actionUpper.toLowerCase();

    return {
      success: true,
      message: `${processedCount} registration(s) ${actionLowered}ed successfully`,
    };
  },

  // Session Management
  async openPaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can open session");
    }

    paper.isSessionOpen = true;
    paper.sessionStartTime = new Date().toISOString();
    paper.status = "ACTIVE" as any;
    await paper.save();

    return paper;
  },

  async closePaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can close session");
    }

    paper.isSessionOpen = false;
    paper.sessionEndTime = new Date().toISOString();
    paper.status = "COMPLETED" as any;
    await paper.save();

    return paper;
  },

  // Annotation Mutations
  async createPaperAnnotation(
    _: any,
    { paperId, page, x, y, width, height, title, text }: any,
    { user }: any,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    const author = await User.findById(user.id).lean();
    if (!author) throw new Error("User not found");

    const annotation = {
      id: new mongoose.Types.ObjectId().toString(),
      page,
      rect: { x, y, width, height },
      title: title || null,
      text,
      author: {
        id: user.id,
        name:
          author.personalInfo?.fullName ||
          author.personalInfo?.username ||
          "Anonymous",
        email: author.personalInfo?.email || "",
      },
      reactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    if (!paper.annotations) paper.annotations = [];
    // Use type assertion to bypass TypeScript strict checking
    (paper.annotations as any).push(annotation);
    await paper.save();

    return annotation;
  },

  async updatePaperAnnotation(_: any, { id, text, title }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findOne({ "annotations.id": id });
    if (!paper) throw new Error("Annotation not found");

    const annotation = (paper.annotations as any)?.find(
      (a: any) => a.id === id,
    );
    if (!annotation) throw new Error("Annotation not found");

    if (annotation.author.id !== user.id) {
      throw new Error("Only the author can update this annotation");
    }

    if (text !== undefined) annotation.text = text;
    if (title !== undefined) annotation.title = title;
    annotation.updatedAt = new Date().toISOString();

    await paper.save();
    return annotation;
  },

  async deletePaperAnnotation(_: any, { id }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findOne({ "annotations.id": id });
    if (!paper) throw new Error("Annotation not found");

    const annotation = (paper.annotations as any)?.find(
      (a: any) => a.id === id,
    );
    if (!annotation) throw new Error("Annotation not found");

    if (annotation.author.id !== user.id) {
      throw new Error("Only the author can delete this annotation");
    }

    paper.annotations = (paper.annotations as any)?.filter(
      (a: any) => a.id !== id,
    );
    await paper.save();

    return true;
  },

  // Reaction Mutations
  async addPaperReaction(
    _: any,
    { annotationId, type, text }: any,
    { user }: any,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findOne({ "annotations.id": annotationId });
    if (!paper) throw new Error("Annotation not found");

    const annotation = (paper.annotations as any)?.find(
      (a: any) => a.id === annotationId,
    );
    if (!annotation) throw new Error("Annotation not found");

    const author = await User.findById(user.id).lean();
    if (!author) throw new Error("User not found");

    // Check if user already reacted with same type
    const existingReaction = annotation.reactions?.find(
      (r: any) => r.author.id === user.id && r.type === type,
    );
    if (existingReaction) {
      throw new Error(`Already reacted with ${type}`);
    }

    const reaction = {
      id: new mongoose.Types.ObjectId().toString(),
      type,
      text: text || null,
      author: {
        id: user.id,
        name:
          author.personalInfo?.fullName ||
          author.personalInfo?.username ||
          "Anonymous",
        email: author.personalInfo?.email || "",
      },
      createdAt: new Date().toISOString(),
    };

    if (!annotation.reactions) annotation.reactions = [];
    annotation.reactions.push(reaction);
    await paper.save();

    return reaction;
  },

  async removePaperReaction(_: any, { id }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findOne({ "annotations.reactions.id": id });
    if (!paper) throw new Error("Reaction not found");

    let reactionFound = false;
    for (const annotation of (paper.annotations as any) || []) {
      const reactionIndex = annotation.reactions?.findIndex(
        (r: any) => r.id === id,
      );
      if (reactionIndex !== undefined && reactionIndex !== -1) {
        const reaction = annotation.reactions[reactionIndex];
        if (reaction.author.id !== user.id) {
          throw new Error("Only the author can remove this reaction");
        }
        annotation.reactions.splice(reactionIndex, 1);
        reactionFound = true;
        break;
      }
    }

    if (!reactionFound) throw new Error("Reaction not found");
    await paper.save();

    return true;
  },

  // Live Session Mutations
  async startPaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");
    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can start a live session");
    }

    // Get user details
    const userDoc = await User.findById(user.id).lean();

    paper.liveSession = {
      isActive: true,
      startedAt: new Date().toISOString(),
      endedAt: undefined,
      currentPage: 1,
      activeAnnotationId: undefined,
      controllerId: new mongoose.Types.ObjectId(user.id),
      participants: [new mongoose.Types.ObjectId(user.id)],
    };
    await paper.save();

    // Return formatted live session for GraphQL
    return {
      isActive: true,
      startedAt: new Date().toISOString(),
      endedAt: null,
      currentPage: 1,
      activeAnnotationId: null,
      controller: {
        id: user.id,
        name:
          userDoc?.personalInfo?.fullName ||
          userDoc?.personalInfo?.username ||
          "Controller",
        email: userDoc?.personalInfo?.email || "",
        personalInfo: userDoc?.personalInfo,
      },
      participants: [
        {
          id: user.id,
          name:
            userDoc?.personalInfo?.fullName ||
            userDoc?.personalInfo?.username ||
            "User",
          email: userDoc?.personalInfo?.email || "",
          personalInfo: userDoc?.personalInfo,
        },
      ],
    };
  },

  async endPaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    const liveSession = paper.liveSession as any;
    if (
      liveSession?.controllerId?.toString() !== user.id &&
      paper.createdBy.toString() !== user.id
    ) {
      throw new Error("Not authorized to end session");
    }

    // Get controller and participants details
    const controllerUser = await User.findById(
      liveSession?.controllerId,
    ).lean();
    const participantUsers = await User.find({
      _id: { $in: liveSession?.participants || [] },
    }).lean();

    const updatedLiveSession = {
      isActive: false,
      startedAt: liveSession?.startedAt,
      endedAt: new Date().toISOString(),
      currentPage: liveSession?.currentPage,
      activeAnnotationId: liveSession?.activeAnnotationId,
      controller: controllerUser
        ? {
            id: controllerUser._id.toString(),
            name:
              controllerUser.personalInfo?.fullName ||
              controllerUser.personalInfo?.username ||
              "Controller",
            email: controllerUser.personalInfo?.email || "",
            personalInfo: controllerUser.personalInfo,
          }
        : null,
      participants: participantUsers.map((p) => ({
        id: p._id.toString(),
        name: p.personalInfo?.fullName || p.personalInfo?.username || "User",
        email: p.personalInfo?.email || "",
        personalInfo: p.personalInfo,
      })),
    };

    paper.liveSession = {
      isActive: false,
      endedAt: new Date().toISOString(),
    };
    await paper.save();

    return updatedLiveSession;
  },

  async joinPaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    const liveSession = paper.liveSession as any;
    if (!liveSession?.isActive) throw new Error("No active live session");

    const isAlreadyParticipant = liveSession.participants?.some(
      (p: any) => p.toString() === user.id,
    );

    if (!isAlreadyParticipant) {
      if (!liveSession.participants) liveSession.participants = [];
      liveSession.participants.push(new mongoose.Types.ObjectId(user.id));
      await paper.save();
    }

    // Get all participants details
    const controllerUser = await User.findById(liveSession.controllerId).lean();
    const participantUsers = await User.find({
      _id: { $in: liveSession.participants || [] },
    }).lean();

    return {
      isActive: liveSession.isActive,
      startedAt: liveSession.startedAt,
      endedAt: liveSession.endedAt,
      currentPage: liveSession.currentPage,
      activeAnnotationId: liveSession.activeAnnotationId,
      controller: controllerUser
        ? {
            id: controllerUser._id.toString(),
            name:
              controllerUser.personalInfo?.fullName ||
              controllerUser.personalInfo?.username ||
              "Controller",
            email: controllerUser.personalInfo?.email || "",
            personalInfo: controllerUser.personalInfo,
          }
        : null,
      participants: participantUsers.map((p) => ({
        id: p._id.toString(),
        name: p.personalInfo?.fullName || p.personalInfo?.username || "User",
        email: p.personalInfo?.email || "",
        personalInfo: p.personalInfo,
      })),
    };
  },

  async leavePaperSession(_: any, { paperId }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    const liveSession = paper.liveSession as any;
    if (liveSession?.participants) {
      liveSession.participants = liveSession.participants.filter(
        (p: any) => p.toString() !== user.id,
      );
      await paper.save();
    }

    // Get remaining participants details
    const controllerUser = await User.findById(
      liveSession?.controllerId,
    ).lean();
    const participantUsers = await User.find({
      _id: { $in: liveSession?.participants || [] },
    }).lean();

    return {
      isActive: liveSession?.isActive || false,
      startedAt: liveSession?.startedAt,
      endedAt: liveSession?.endedAt,
      currentPage: liveSession?.currentPage,
      activeAnnotationId: liveSession?.activeAnnotationId,
      controller: controllerUser
        ? {
            id: controllerUser._id.toString(),
            name:
              controllerUser.personalInfo?.fullName ||
              controllerUser.personalInfo?.username ||
              "Controller",
            email: controllerUser.personalInfo?.email || "",
            personalInfo: controllerUser.personalInfo,
          }
        : null,
      participants: participantUsers.map((p) => ({
        id: p._id.toString(),
        name: p.personalInfo?.fullName || p.personalInfo?.username || "User",
        email: p.personalInfo?.email || "",
        personalInfo: p.personalInfo,
      })),
    };
  },

  async navigatePaperSession(_: any, { paperId, page }: any, { user }: any) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    const liveSession = paper.liveSession as any;
    if (!liveSession?.isActive) throw new Error("No active live session");
    if (liveSession.controllerId?.toString() !== user.id) {
      throw new Error("Only session controller can navigate");
    }

    if (page !== undefined) liveSession.currentPage = page;
    await paper.save();

    // Get controller and participants details
    const controllerUser = await User.findById(liveSession.controllerId).lean();
    const participantUsers = await User.find({
      _id: { $in: liveSession.participants || [] },
    }).lean();

    return {
      isActive: liveSession.isActive,
      startedAt: liveSession.startedAt,
      endedAt: liveSession.endedAt,
      currentPage: liveSession.currentPage,
      activeAnnotationId: liveSession.activeAnnotationId,
      controller: controllerUser
        ? {
            id: controllerUser._id.toString(),
            name:
              controllerUser.personalInfo?.fullName ||
              controllerUser.personalInfo?.username ||
              "Controller",
            email: controllerUser.personalInfo?.email || "",
            personalInfo: controllerUser.personalInfo,
          }
        : null,
      participants: participantUsers.map((p) => ({
        id: p._id.toString(),
        name: p.personalInfo?.fullName || p.personalInfo?.username || "User",
        email: p.personalInfo?.email || "",
        personalInfo: p.personalInfo,
      })),
    };
  },
};

export default paperMutations;
