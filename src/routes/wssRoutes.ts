import express, { Request, Response, Router } from "express";

// Define interfaces for the models
import Resource from "../models/Resource"; // Import your mongoose model
import User from "../models/User";
import Paper from "../models/Paper";
// Reusable function to fetch a Resource
async function fetchResource(req: Request, res: Response) {
  const { sessionId, accessKey } = req.query;

  if (!sessionId || !accessKey) {
    return res.status(400).json({ error: "Missing sessionId or accessKey" });
  }

  try {
    const resource = await Resource.findOne({
      accessKey,
      sessionId,
    })
      .populate({
        path: "createdBy",
        model: User,
        select: {
          id: 1,
          "personalInfo.username": 1,
          "personalInfo.fullName": 1,
          "personalInfo.email": 1,
          "personalInfo.scholarId": 1,
          "personalInfo.activationToken": 1,
          "personalInfo.resetToken": 1,
          "personalInfo.tokenExpiry": 1,
          "personalInfo.activatedAccount": 1,
          role: 1,
        },
      })
      .exec();

    if (!resource) {
      return res.status(404).json({ error: "Resource not found." });
    }
    return res.json(resource);
  } catch (error) {
    console.error("Error fetching resource:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// Poll Route Logic (find Resource)
const pollRoutes = express.Router();
pollRoutes.get("/", fetchResource);

// Poster Route Logic (find Resource)
const posterRoutes = express.Router();
posterRoutes.get("/", fetchResource);

// Paper Route Logic (find Paper)
const paperRoutes = express.Router();
paperRoutes.get("/", async (req: Request, res: Response) => {
  const { sessionId, accessKey } = req.query;

  if (!sessionId || !accessKey) {
    return res.status(400).json({ error: "Missing sessionId or accessKey" });
  }

  try {
    const paper = await Paper.findOne({
      accessKey,
      sessionId,
    })
      .populate({
        path: "createdBy",
        model: User,
        select: {
          _id: 1,
          personalInfo: {
            username: 1,
            fullName: 1,
            email: 1,
            scholarId: 1,
            institution: 1,
          },
          role: 1,
        },
      })
      .select({
        id: 1,
        title: 1,
        objective: 1,
        url: 1,
        participants: 1,
        accessKey: 1,
        sessionId: 1,
        activeDiscussionId: 1,
        discussion: {
          $elemMatch: {},
          page: 1,
          title: 1,
          reactions: 1,
          text: 1,
          x: 1,
          y: 1,
          width: 1,
          height: 1,
          id: 1,
          author: 1,
          timestamp: 1,
        },
        reactions: 1,
        createdDate: 1,
        createdBy: {
          id: 1,
          role: 1,
          personalInfo: {
            username: 1,
          },
        },
      })
      .exec();

    if (!paper) {
      return res.status(404).json({ error: "Paper not found." });
    }
    return res.json(paper);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Task Route Logic (find Resource)
const taskRoutes = express.Router();
taskRoutes.get("/", fetchResource);

// Modelling Labs Route Logic (find Resource)
const tutorPlexRoutes = express.Router();
tutorPlexRoutes.get("/", fetchResource);

// Combine Routes
const wssRoutes = express.Router();
wssRoutes.use("/poll", pollRoutes);
wssRoutes.use("/poster", posterRoutes);
wssRoutes.use("/paper", paperRoutes);
wssRoutes.use("/task", taskRoutes);
wssRoutes.use("/tutor-plex", tutorPlexRoutes);

export default wssRoutes;
