// routes/resourceUploaders/assignmentUploader.ts
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

// Assignment participant enrollment
router.post("/assignment/participant", async (req: Request, res: Response) => {
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

    let resourceParticipants: any[] = [];
    if (
      (resource as any).participants &&
      (resource as any).participants.length
    ) {
      resourceParticipants = JSON.parse((resource as any).participants);
    }

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
    res.status(500).json({ error: "An error occurred while processing data" });
  }
});

// Assignment enroll (accept/reject)
router.post("/assignment/enroll", async (req: Request, res: Response) => {
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

// Assignment update metadata
router.post("/assignment/update", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  const { wipeParticipants, assignmentDuration, assignmentDeadline } = req.body;

  if (!wipeParticipants || !assignmentDuration || !assignmentDeadline) {
    return res.status(400).json({
      error: "Task date, start time, duration, and end time are required.",
    });
  }

  try {
    const resource = await Resource.findOne({ sessionId });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    let content = JSON.parse((resource as any).content);
    let assignmentMetaInfo = JSON.parse(content.assignmentMetaInfo);

    function formatDate(input: string): string {
      const dateStr = input.replace(
        /(\w+)\s(\d+)\s(\w+)\s(\d+)\sat\s(\d+:\d+)/,
        "$2 $3 $4 $5",
      );
      const date = new Date(dateStr);

      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      };

      const formattedDate = date.toLocaleString("en-US", options);
      const timeZoneOffset = "+3";
      return `${formattedDate} GMT${timeZoneOffset}`;
    }

    const formattedDateString = formatDate(assignmentDeadline);
    assignmentMetaInfo.assignmentDuration = assignmentDuration;
    assignmentMetaInfo.assignmentDeadline = formattedDateString;

    content.assignmentMetaInfo = JSON.stringify(assignmentMetaInfo);
    (resource as any).content = JSON.stringify(content);

    if (wipeParticipants === "Yes") {
      (resource as any).participants = "[]";
    }

    await resource.save();

    res.json({
      message: "Assignment information updated successfully",
      resource,
    });
  } catch (error) {
    console.error("Error updating resource:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

// Assignment task response (file or text)
router.post(
  "/assignment/response",
  contentUpload.array("files", 10),
  async (req: Request, res: Response) => {
    const { sessionId, userId, questionType } = {
      ...req.query,
      ...req.body,
    };

    if (!sessionId || !userId || !questionType) {
      return res.status(400).json({
        error: "Session ID, User ID, and Question Type are required",
      });
    }

    const [resource, participant] = await Promise.all([
      Resource.findOne({ sessionId }),
      User.findById(userId),
    ]);

    if (!resource || !participant) {
      return res
        .status(404)
        .json({ error: "Resource or participant not found" });
    }

    // Handle file upload
    if (req.is("multipart/form-data")) {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      try {
        const uploadPromises = files.map(async (file) => {
          const fileExtension = path.extname(file.originalname).toLowerCase();

          if (![".jpg", ".jpeg", ".png", ".pdf"].includes(fileExtension)) {
            throw new Error("Only image or PDF files are allowed");
          }

          const fileName = `${uuidv4()}-${file.originalname}`;
          const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME as string,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
          };

          const command = new PutObjectCommand(uploadParams);
          await s3Client.send(command);

          return `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        const s3URL = uploadedFiles[0];

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

        return res.json({
          message: "File uploaded and response saved",
          responseObject,
        });
      } catch (error) {
        console.error("Error uploading files:", error);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    // Handle JSON text submission
    if (req.is("application/json")) {
      try {
        const { questionResponse, savedDate } = req.body;

        if (!questionResponse || !savedDate) {
          return res.status(400).json({ error: "Invalid JSON data" });
        }

        const responseObject = {
          questionType,
          questionResponse,
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

        return res.json({
          message: "Task response saved successfully",
          responseObject,
        });
      } catch (error) {
        console.error("Error processing JSON submission:", error);
        return res.status(500).json({ error: "An error occurred" });
      }
    }

    return res.status(400).json({
      error: "Unsupported content type. Please upload files or send JSON data.",
    });
  },
);

export default router;
