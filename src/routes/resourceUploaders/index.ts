// routes/resourceUploaders/index.ts
import express from "express";
import paperRouter from "./paperUploader";
import examRouter from "./examUploader";
import assignmentRouter from "./assignmentUploader";
import presentationRouter from "./presentationUploader";
import genericRouter from "./genericUploader";

const router = express.Router();

// Mount all routers to their respective paths
router.use("/paper", paperRouter);
router.use("/exam", examRouter);
router.use("/assignment", assignmentRouter);
router.use("/slides", presentationRouter);
router.use("/", genericRouter);

// Export the combined router as default
export default router;

// Also export individual routers if needed elsewhere
export {
  paperRouter,
  examRouter,
  assignmentRouter,
  presentationRouter,
  genericRouter,
};
