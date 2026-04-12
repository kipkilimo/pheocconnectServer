// routes/resourceUploaders/paperUploader.ts
import express, { Request, Response } from "express";
import User from "../../models/User";
import Paper from "../../models/Paper";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const router = express.Router();

// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

// Add paper participant enroll request
router.post("/paper/participant", async (req: Request, res: Response) => {
  const { sessionId, userId } = req.body;

  if (!sessionId || !userId) {
    return res
      .status(400)
      .json({ error: "Session ID and User ID are required" });
  }

  try {
    const [resource, participant] = await Promise.all([
      Paper.findOne({ sessionId }),
      User.findById(userId),
    ]);

    if (!resource) {
      return res.status(404).json({ error: "Paper not found" });
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

// Handle POST request to paper enroll
router.post("/paper/enroll", async (req: Request, res: Response) => {
  const { sessionId, action, participantId, participantIds } = req.body;

  if (!sessionId || !action) {
    return res
      .status(400)
      .json({ error: "Session ID and action are required" });
  }

  try {
    const resource = await Paper.findOne({ sessionId });

    if (!resource) {
      return res.status(404).json({ error: "Paper not found" });
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

export default router;
