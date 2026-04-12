// routes/resourceUploaders/examUploader.ts
import express, { Request, Response } from "express";
import User from "../../models/User";
import Resource from "../../models/Resource";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";

dotenv.config();

const router = express.Router();
const contentArrayLimit = 720 * 1024 * 1024; // 720MB

const contentUpload = multer({
  limits: { fileSize: contentArrayLimit },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

// Exam participant enrollment
router.post("/exam/participant", async (req: Request, res: Response) => {
  const { sessionId, userId } = req.body;

  if (!sessionId || !userId) {
    return res
      .status(400)
      .json({ error: "Session ID and User ID are required" });
  }

  try {
    const [resource, participant] = await Promise.all([
      Resource.findOne({ sessionId }),
      User.findById(userId),
    ]);

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (!participant) {
      return res.status(404).json({ error: "User not found" });
    }

    let resourceParticipants: any[] = (resource as any).participants?.length
      ? JSON.parse((resource as any).participants)
      : [];

    if (resourceParticipants.length >= 50) {
      return res.status(400).json({ error: "Cannot add more participants" });
    }

    const userExists = resourceParticipants.some(
      (p: any) => p.userId === userId,
    );
    if (userExists) {
      return res.json({ message: "Participant already exists", userId });
    }

    const participantDetails = {
      sessionId,
      userId,
      requestedDate: new Date(),
      requestStatus: "PENDING",
      participantName: participant.personalInfo.fullName,
      resourceResponses: [],
    };

    resourceParticipants.push(participantDetails);
    (resource as any).participants = JSON.stringify(resourceParticipants);
    await resource.save();

    res.json({ message: "Participant added successfully", participantDetails });
  } catch (error) {
    console.error("Error processing participant data:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

// Exam enroll (accept/reject)
router.post("/exam/enroll", async (req: Request, res: Response) => {
  const { sessionId, action, participantId, participantIds } = req.body;

  if (!sessionId || !action) {
    return res
      .status(400)
      .json({ error: "Session ID and action are required" });
  }

  try {
    const resource = await Resource.findOne({ sessionId });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    let updatedParticipants: any[] = JSON.parse(
      (resource as any).participants || "[]",
    );

    if (action === "ACCEPT") {
      if (!participantId) {
        return res
          .status(400)
          .json({ error: "Participant ID is required for accept" });
      }

      const participant = await User.findById(participantId);
      if (participant) {
        updatedParticipants.push({
          userId: participantId,
          requestStatus: "ENROLLED",
          requestedDate: new Date(),
          participantName: participant.personalInfo.fullName,
          resourceResponses: [],
        });
      }
    } else if (action === "REJECT") {
      if (!participantId) {
        return res
          .status(400)
          .json({ error: "Participant ID is required for reject" });
      }

      updatedParticipants = updatedParticipants.filter(
        (p: any) => p.userId !== participantId,
      );
    } else if (action === "ACCEPT_ALL") {
      if (!participantIds || !Array.isArray(participantIds)) {
        return res
          .status(400)
          .json({ error: "Participant IDs are required for accept all" });
      }

      for (const id of participantIds) {
        const participant = await User.findById(id);
        if (participant) {
          updatedParticipants.push({
            userId: id,
            requestStatus: "ENROLLED",
            requestedDate: new Date(),
            participantName: participant.personalInfo.fullName,
            resourceResponses: [],
          });
        }
      }
    }

    const uniqueParticipants = Array.from(
      new Map(updatedParticipants.map((p: any) => [p.userId, p])).values(),
    );

    (resource as any).participants = JSON.stringify(uniqueParticipants);
    await resource.save();

    res.json({
      message: "Participant data updated successfully",
      participants: uniqueParticipants,
    });
  } catch (error) {
    console.error("Error processing participant data:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing participant data" });
  }
});

// Exam update metadata
router.post("/exam/update", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const {
    examDate,
    examStartTime,
    wipeParticipants,
    examDuration,
    examEndTime,
  } = req.body;

  if (
    !examDate ||
    !examStartTime ||
    !wipeParticipants ||
    !examDuration ||
    !examEndTime
  ) {
    return res.status(400).json({
      error: "Exam date, start time, duration, and end time are required.",
    });
  }

  try {
    const resource = await Resource.findOne({ sessionId });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    let content = JSON.parse((resource as any).content);
    let examMetaInfo = JSON.parse(content.examMetaInfo);

    examMetaInfo.examDate = examDate;
    examMetaInfo.examStartTime = examStartTime;
    examMetaInfo.examDuration = examDuration;
    examMetaInfo.examEndTime = examEndTime;

    content.examMetaInfo = JSON.stringify(examMetaInfo);
    (resource as any).content = JSON.stringify(content);

    if (wipeParticipants === "Yes") {
      (resource as any).participants = "[]";
    }

    await resource.save();

    res.json({
      message: "Exam meta information updated successfully",
      resource,
    });
  } catch (error) {
    console.error("Error updating resource:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

// Exam text submission
router.post("/exam/text", async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, questionType } = req.query;
    const responseObject = req.body;

    const [resource, participant] = await Promise.all([
      Resource.findOne({ sessionId }),
      User.findById(userId),
    ]);

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (!participant) {
      return res.status(404).json({ error: "User not found" });
    }

    let resourceParticipants: any[] = JSON.parse(
      (resource as any).participants || "[]",
    );
    const participantIndex = resourceParticipants.findIndex(
      (p: any) => p.userId === userId,
    );

    if (participantIndex === -1) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const existingResponseIndex = resourceParticipants[
      participantIndex
    ].resourceResponses.findIndex(
      (response: any) => response.questionType === questionType,
    );

    if (existingResponseIndex !== -1) {
      resourceParticipants[participantIndex].resourceResponses[
        existingResponseIndex
      ] = responseObject;
    } else {
      resourceParticipants[participantIndex].resourceResponses.push(
        responseObject,
      );
    }

    (resource as any).participants = JSON.stringify(resourceParticipants);
    await resource.save();

    res.json({ message: "Response saved", responseObject });
  } catch (error) {
    console.error("Error processing request:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

// Exam attempt with file upload
router.post(
  "/exam/attempt",
  contentUpload.array("files", 1),
  async (req: Request, res: Response) => {
    const { sessionId, userId, questionType } = req.query;
    const files = req.files as Express.Multer.File[];

    if (!sessionId || !userId || !questionType) {
      return res.status(400).json({
        error: "Session ID, User ID, and Question Type are required",
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    try {
      const [resource, participant] = await Promise.all([
        Resource.findOne({ sessionId }),
        User.findById(userId),
      ]);

      if (!resource || !participant) {
        return res
          .status(404)
          .json({ error: "Resource or participant not found" });
      }

      const uploadedFile = files[0];
      const fileExtension = path
        .extname(uploadedFile.originalname)
        .toLowerCase();

      if (![".jpg", ".jpeg", ".png", ".pdf"].includes(fileExtension)) {
        return res
          .status(400)
          .json({ error: "Only image or PDF files are allowed" });
      }

      const fileName = `${uuidv4()}-${uploadedFile.originalname}`;
      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME as string,
        Key: fileName,
        Body: uploadedFile.buffer,
        ContentType: uploadedFile.mimetype,
      };

      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      const s3URL = `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

      const responseObject = {
        questionType,
        questionResponse: s3URL,
        savedDate: Date.now(),
      };

      let resourceParticipants: any[] = JSON.parse(
        (resource as any).participants || "[]",
      );
      const participantIndex = resourceParticipants.findIndex(
        (p: any) => p.userId === userId,
      );

      if (participantIndex === -1) {
        return res.status(404).json({ error: "Participant not found" });
      }

      const existingResponseIndex = resourceParticipants[
        participantIndex
      ].resourceResponses.findIndex(
        (response: any) => response.questionType === questionType,
      );

      if (existingResponseIndex !== -1) {
        resourceParticipants[participantIndex].resourceResponses[
          existingResponseIndex
        ] = responseObject;
      } else {
        resourceParticipants[participantIndex].resourceResponses.push(
          responseObject,
        );
      }

      (resource as any).participants = JSON.stringify(resourceParticipants);
      await resource.save();

      res.json({ message: "File uploaded and response saved", responseObject });
    } catch (error) {
      console.error("Error processing request:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing the request" });
    }
  },
);

export default router;
