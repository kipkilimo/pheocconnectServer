// pdfComment.ts
import { Router, Request, Response } from "express";
import Paper from "../models/Paper"; // Import your mongoose model

const router = Router();

// Example in-memory data store for comments
let comments: Array<{
  id: string;
  pdfId: string;
  page: number;
  user: string;
  content: string;
  timestamp: string;
  coordinates: { x: number; y: number };
}> = [];

// Get comments for a specific PDF
router.get("/api/comments/:pdfId", (req: Request, res: Response) => {
  const { pdfId } = req.params;
  const pdfComments = comments.filter((comment) => comment.pdfId === pdfId);
  res.json(pdfComments);
});

// Post a new comment
router.post("/api/comments", (req: Request, res: Response) => {
  const { pdfId, page, user, content, coordinates } = req.body;
  const id = Math.random().toString(36).substr(2, 9); // Generate a random ID
  const timestamp = new Date().toISOString();
  const newComment = { id, pdfId, page, user, content, timestamp, coordinates };
  comments.push(newComment);

  res.status(201).json(newComment);
});

// Update a comment (optional)
router.put("/api/comments/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, coordinates } = req.body;
  const comment = comments.find((comment) => comment.id === id);

  if (comment) {
    comment.content = content;
    comment.coordinates = coordinates;
    res.json(comment);
  } else {
    res.status(404).send("Comment not found");
  }
});

// Delete a comment (optional)
router.delete("/api/comments/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const index = comments.findIndex((comment) => comment.id === id);

  if (index !== -1) {
    comments.splice(index, 1);
    res.sendStatus(204);
  } else {
    res.status(404).send("Comment not found");
  }
});

export default router;
