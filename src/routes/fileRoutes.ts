import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import express, { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

import Lab from "../database/models/Lab";

dotenv.config();

const router: Router = express.Router();

/* ============================================
 S3 SINGLETON
============================================ */

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
      },
      maxAttempts: 3,
    });
  }
  return s3Client;
};

/* ============================================
 MULTER CONFIG
============================================ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

/* ============================================
 HELPERS
============================================ */

const generateS3Key = (prefix: string, originalName: string): string => {
  const clean = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${prefix}/${uuidv4()}-${clean}`;
};

const getFileUrl = (bucket: string, region: string, key: string): string =>
  `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

const validateRequiredParams = (params: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    for (const p of params) {
      if (!req.body[p] && !req.query[p]) {
        return res.status(400).json({ error: `${p} is required` });
      }
    }
    next();
  };
};

/* ============================================
 🧪 LAB RESULTS UPLOAD (PHEOC CORE)
============================================ */

router.post(
  "/lab-upload",
  upload.single("file"),
  validateRequiredParams(["incidentId", "eocId", "patientRef"]),
  async (req: Request, res: Response): Promise<Response> => {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { incidentId, eocId, patientRef, resultType } = req.body;

      const bucket = process.env.AWS_BUCKET_NAME!;
      const region = process.env.AWS_REGION!;

      const s3 = getS3Client();

      // Generate S3 key
      const fileKey = generateS3Key("labs", req.file.originalname);

      // Upload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }),
      );

      const fileUrl = getFileUrl(bucket, region, fileKey);

      // Create lab record (PHEOC surveillance core entity)
      const labRecord = await Lab.create({
        incidentId,
        eocId,
        patientRef,
        resultType: resultType || "UNKNOWN",
        fileUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        status: "PENDING_REVIEW",
        uploadedAt: new Date().toISOString(),
        metadata: {
          size: req.file.size,
        },
      });

      const duration = Date.now() - startTime;

      return res.status(201).json({
        success: true,
        message: "Lab result uploaded successfully",
        data: {
          lab: labRecord,
          fileUrl,
          processingTime: `${duration}ms`,
        },
      });
    } catch (error) {
      console.error("Lab upload error:", error);

      return res.status(500).json({
        error: "Lab upload failed",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

/* ============================================
 HEALTH CHECK
============================================ */

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    service: "lab-file-upload",
    timestamp: new Date().toISOString(),
  });
});

export default router;
