// src/graphql/resolvers/paperResolvers/mutations.ts
import fs from "fs/promises";
import path from "path";

import mongoose from "mongoose";
import crypto from "crypto";
import Paper, { PaperRegistrationStatusEnum } from "../../../models/Paper";
import User from "../../../models/User";
import { generateUniqueCode } from "../../../utils/identifier_generator";
import generateAccessKey from "../../../utils/accessKeyUtility";
import jwt from "jsonwebtoken";
import {
  generateQRCodeDataUrl,
  generatePaperQRCodePDFBuffer,
  uploadPDFToS3,
  sendPaperCreatedEmailWithAttachment,
} from "./utils"; // adjust path if needed

interface GraphQLContext {
  user?: {
    id: string;
    personalInfo?: {
      fullName?: string;
      username?: string;
      email?: string;
    };
  };
}

interface CreatePaperInput {
  title: string;
  objective: string;
  url?: string;
  createdBy: string;
  sessionStartTime: string;
  sessionEndTime: string;
  maxParticipants?: number;
  isSessionOpen?: boolean;
}

interface RegisterForPaperSessionInput {
  sessionId: string;
  email: string;
  name: string;
  courseTaken?: string;
  level?: string;
}

const paperMutations = {
  async createPaper(
    _: any,
    { input }: { input: CreatePaperInput },
    context: GraphQLContext,
  ) {
    try {
      const {
        title,
        objective,
        url,
        createdBy,
        sessionStartTime,
        maxParticipants,
        isSessionOpen,
      } = input;

      if (!sessionStartTime) throw new Error("sessionStartTime is required");

      const start = new Date(sessionStartTime);
      if (isNaN(start.getTime())) throw new Error("Invalid sessionStartTime");

      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const accessKeyStr = generateAccessKey();
      const sessionId = generateUniqueCode(12);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8000";
      const joinUrl = `${frontendUrl}/papers/live/${sessionId}`;

      // ============================================
      // 1. CREATE PAPER
      // ============================================
      const paper = await Paper.create({
        title,
        objective: objective || "",
        url: url || "",
        sessionStartTime: start.toISOString(),
        sessionEndTime: end.toISOString(),
        createdBy,
        sessionId,
        accessKey: accessKeyStr,
        qrCodeUrl: joinUrl,
        isSessionOpen: isSessionOpen ?? false,
        maxParticipants: maxParticipants ?? 100,
        registrations: [],
        createdAt: new Date().toISOString(),
      });

      // ============================================
      // 2. FETCH USER (ONLY NEEDED ONCE)
      // ============================================
      const user = await User.findById(createdBy).lean();
      if (!user) throw new Error("Creator not found");

      // ============================================
      // 3. GENERATE PDF
      // ============================================
      const pdfBuffer = await generatePaperQRCodePDFBuffer({
        title,
        sessionId,
        accessKey: accessKeyStr,
        createdDate: new Date(),
        requiresAuth: false,
        sessionStartTime: start.toISOString(),
        joinUrl,
      });

      // ============================================
      // 4. TEMP FILE (optional debug only)
      // ============================================
      const tempDir = path.join(process.cwd(), "temp");
      await fs.mkdir(tempDir, { recursive: true });

      const tempPath = path.join(tempDir, `${sessionId}.pdf`);
      await fs.writeFile(tempPath, pdfBuffer);

      // ============================================
      // 5. EMAIL (NO pdfUrl HERE)
      // ============================================
      await sendPaperCreatedEmailWithAttachment({
        email: user.personalInfo.email,
        name: user.personalInfo.fullName || "User",
        paperTitle: title,
        sessionId,
        accessKey: accessKeyStr,
        joinUrl,
        qrCodeUrl: await generateQRCodeDataUrl(joinUrl),
        createdDate: new Date(),
      });

      // ============================================
      // 6. UPLOAD FINAL PDF
      // ============================================
      const pdfUrl = await uploadPDFToS3(pdfBuffer, sessionId, title);

      // ============================================
      // 7. CLEAN TEMP FILE
      // ============================================
      await fs.unlink(tempPath).catch(() => {});

      // ============================================
      // 8. UPDATE PAPER
      // ============================================
      await Paper.updateOne(
        { _id: paper._id },
        {
          $set: {
            url: pdfUrl,
            qrCodeUrl: joinUrl,
          },
        },
      );

      // ============================================
      // 9. SAFE RETURN (NO SECOND DB QUERY)
      // ============================================
      const createdByUser = user;

      return {
        id: paper._id.toString(),
        title: paper.title,
        objective: paper.objective,
        sessionId: paper.sessionId,
        url: pdfUrl,
        qrCodeUrl: joinUrl,
        sessionStartTime: paper.sessionStartTime,
        sessionEndTime: paper.sessionEndTime,
        maxParticipants: paper.maxParticipants,
        isSessionOpen: paper.isSessionOpen ?? false,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt || null,

        createdBy: {
          id: createdByUser._id.toString(),
          name: createdByUser.personalInfo.fullName,
          email: createdByUser.personalInfo.email,
        },
      };
    } catch (error) {
      console.error("Error creating paper:", error);
      throw new Error("Failed to create paper");
    }
  },
  async updatePaper(_: any, args: any) {
    const { id, title, objective, maxParticipants } = args;
    const paper = await Paper.findById(id);
    if (!paper) throw new Error("Paper not found");

    if (title !== undefined) paper.title = title;
    if (objective !== undefined) paper.objective = objective;
    if (maxParticipants !== undefined) paper.maxParticipants = maxParticipants;
    paper.updatedAt = new Date().toISOString();

    await paper.save();
    return paper;
  },

  async registerForPaperdiveSession(
    _: any,
    { input }: { input: RegisterForPaperSessionInput },
  ) {
    try {
      const { sessionId, email, name, courseTaken, level } = input;

      const paper = await Paper.findOne({ sessionId });
      if (!paper) throw new Error("Paper session not found");

      const existingRegistration = (paper.registrations || []).find(
        (r: any) => r.emailAddress === email || r.email === email,
      );

      if (existingRegistration) {
        const isApproved =
          existingRegistration.status === PaperRegistrationStatusEnum.APPROVED;
        return {
          success: isApproved,
          message: isApproved
            ? "Already registered and approved"
            : "Already pending",
          registrationId: existingRegistration.id,
          status: existingRegistration.status,
          approvalToken: existingRegistration.approvalToken,
          paperId: paper._id.toString(),
          sessionId: paper.sessionId,
        };
      }

      const approvalToken = crypto.randomBytes(32).toString("hex");
      const newRegistration = {
        id: new mongoose.Types.ObjectId().toString(),
        sessionId: paper.sessionId,
        name: name || email.split("@")[0],
        emailAddress: email,
        email,
        courseTaken: courseTaken || "Not specified",
        level: level || "Not specified",
        registeredAt: new Date().toISOString(),
        status: PaperRegistrationStatusEnum.PENDING,
        approvalToken,
        registeredVia: "QR_CODE",
      };

      paper.registrations = paper.registrations || [];
      paper.registrations.push(newRegistration);
      await paper.save();

      return {
        success: true,
        message: "Registration submitted successfully",
        registrationId: newRegistration.id,
        status: PaperRegistrationStatusEnum.PENDING,
        approvalToken,
        paperId: paper._id.toString(),
        sessionId: paper.sessionId,
      };
    } catch (error: any) {
      console.error("Registration error:", error);
      throw new Error(error.message || "Failed to register");
    }
  },

  async managePaperRegistrations(
    _: any,
    {
      paperId,
      registrationIds,
    }: { paperId: string; registrationIds: string[] },
    { user }: GraphQLContext,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can process registrations");
    }

    let processedCount = 0;
    let approvedCount = (paper.registrations || []).filter(
      (r: any) => r.status === PaperRegistrationStatusEnum.APPROVED,
    ).length;

    for (const regId of registrationIds) {
      const registration = (paper.registrations || []).find(
        (r: any) => r.id === regId,
      );
      if (
        !registration ||
        registration.status !== PaperRegistrationStatusEnum.PENDING
      )
        continue;

      if (paper.maxParticipants && approvedCount >= paper.maxParticipants) {
        registration.status = PaperRegistrationStatusEnum.WAITING;
      } else {
        registration.status = PaperRegistrationStatusEnum.APPROVED;
        registration.approvedAt = new Date().toISOString();
        approvedCount++;
        processedCount++;
      }
    }

    paper.updatedAt = new Date().toISOString();
    await paper.save();

    return {
      success: true,
      message: `${processedCount} registration(s) approved successfully`,
    };
  },
  async renewWebSocketToken(
    _: any,
    { registrationId, paperId }: { registrationId: string; paperId: string },
    { user }: GraphQLContext,
  ) {
    // Check authentication (optional - can be called with or without user)
    // Token renewal might be called from email link without authenticated session

    const paper = await Paper.findById(paperId);
    if (!paper) {
      throw new Error("Paper not found");
    }

    // Find the registration
    const registration = paper.registrations?.find(
      (r) => r.id === registrationId,
    );

    if (!registration) {
      throw new Error("Registration not found");
    }

    // Check if registration is approved
    if (registration.status !== PaperRegistrationStatusEnum.APPROVED) {
      throw new Error("Only approved registrations can renew tokens");
    }

    // Optional: Check if paper session is open
    if (!paper.isSessionOpen) {
      throw new Error("Paper session is not open");
    }

    // Generate new JWT token
    const token = jwt.sign(
      {
        sessionId: paper.sessionId,
        registrationId: registration.id,
        email: registration.emailAddress,
        name: registration.name,
        paperId: paper.id,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "3h" }, // 3-hour token
    );

    // Update registration with new token info
    registration.lastTokenIssuedAt = new Date();
    registration.lastToken = token;
    paper.updatedAt = new Date().toISOString();

    await paper.save();

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      message: "Token renewed successfully",
      token,
      expiresAt,
      registrationId: registration.id,
      paperId: paper.id,
    };
  },
  async openPaperSession(
    _: any,
    { paperId }: { paperId: string },
    { user }: GraphQLContext,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can open session");
    }

    paper.isSessionOpen = true;
    paper.updatedAt = new Date().toISOString();
    await paper.save();

    return paper;
  },

  async closePaperSession(
    _: any,
    { paperId }: { paperId: string },
    { user }: GraphQLContext,
  ) {
    if (!user?.id) throw new Error("Not authenticated");

    const paper = await Paper.findById(paperId);
    if (!paper) throw new Error("Paper not found");

    if (paper.createdBy.toString() !== user.id) {
      throw new Error("Only paper creator can close session");
    }

    paper.isSessionOpen = false;
    paper.updatedAt = new Date().toISOString();
    await paper.save();

    return paper;
  },
};

export default paperMutations;
