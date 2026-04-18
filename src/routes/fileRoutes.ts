import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import express, { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import Paper from "../models/Paper";
import Consultation from "../models/Consultation";

dotenv.config();

// ==========================
// OPTIMIZED CONFIGURATION
// ==========================
const router: Router = express.Router();

// Singleton S3 client
let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
      },
      maxAttempts: 3, // Retry logic
      requestHandler: {
        connectionTimeout: 5000,
        socketTimeout: 10000,
      },
    });
  }
  return s3Client;
};

// Optimized multer configuration with memory limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// ==========================
// OPTIMIZED HELPER FUNCTIONS
// ==========================
const base64ToBuffer = (
  base64: string,
): { mimeType: string; buffer: Buffer } => {
  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 string");
  return {
    mimeType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
};

const generateS3Key = (prefix: string, originalName: string): string => {
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${prefix}/${uuidv4()}-${sanitizedName}`;
};

const getFileUrl = (bucketName: string, region: string, key: string): string =>
  `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

// Validation middleware
const validateRequiredParams = (params: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    for (const param of params) {
      if (!req.query[param] && !req.body[param]) {
        return res.status(400).json({ error: `${param} is required` });
      }
    }
    next();
  };
};

// ==========================
// OPTIMIZED ROUTES
// ==========================
// PAPER UPLOAD ROUTE
router.post(
  "/upload",
  upload.single("file"),
  validateRequiredParams(["paperId"]),
  async (req: Request, res: Response): Promise<Response> => {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "Only PDF files are allowed" });
      }

      const { paperId } = req.query;

      // FIX: Select both id AND qrCodeUrl
      const paper = await Paper.findById(paperId)
        .select("id qrCodeUrl") // Added qrCodeUrl to selection
        .lean()
        .maxTimeMS(3000);

      if (!paper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const qrCodeBase64 = paper.qrCodeUrl;
      const bucketName = process.env.AWS_BUCKET_NAME;
      const region = process.env.AWS_REGION;

      if (!bucketName || !region) {
        return res.status(500).json({ error: "AWS configuration missing" });
      }

      const s3 = getS3Client();
      const uploadPromises: Promise<any>[] = [];

      // PDF Upload
      const pdfKey = generateS3Key("papers", req.file.originalname);
      uploadPromises.push(
        s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: pdfKey,
            Body: req.file.buffer,
            ContentType: "application/pdf",
          }),
        ),
      );

      let qrUrl: string | null = null;

      // QR Upload (if provided and is base64 string, not already an S3 URL)
      if (qrCodeBase64 && qrCodeBase64.startsWith("data:image/png;base64,")) {
        try {
          const { buffer, mimeType } = base64ToBuffer(qrCodeBase64);

          if (!mimeType.includes("png")) {
            return res
              .status(400)
              .json({ error: "QR code must be PNG format" });
          }

          const qrKey = generateS3Key("qrcodes", `qr_${paperId}.png`);
          await s3.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: qrKey,
              Body: buffer,
              ContentType: mimeType,
            }),
          );

          qrUrl = getFileUrl(bucketName, region, qrKey);
        } catch (qrError) {
          console.error("QR code upload error:", qrError);
          // Don't fail the whole upload if QR fails, just log it
          // return res.status(500).json({ error: "QR code upload failed" });
        }
      }

      // Wait for PDF upload to complete
      await Promise.all(uploadPromises);
      const pdfUrl = getFileUrl(bucketName, region, pdfKey);

      // Update database
      const updateData: any = { url: pdfUrl };
      if (qrUrl) updateData.qrCodeUrl = qrUrl;

      const updatedPaper = await Paper.findByIdAndUpdate(paperId, updateData, {
        new: true,
        lean: true,
        maxTimeMS: 5000,
      });

      if (!updatedPaper) {
        return res.status(404).json({ error: "Paper not found" });
      }

      const duration = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        message: "Files uploaded successfully",
        data: {
          pdfUrl,
          qrCodeUrl: qrUrl,
          paper: updatedPaper,
          processingTime: `${duration}ms`,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        error: "Upload failed",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);
// CONSULTATION FILE UPLOAD ROUTE
router.post(
  "/consultation-file",
  upload.single("file"),
  validateRequiredParams(["consultationId"]),
  async (req: Request, res: Response): Promise<Response> => {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { consultationId, description } = req.query;
      const bucketName = process.env.AWS_BUCKET_NAME;
      const region = process.env.AWS_REGION;
      const MAX_UPLOADS = 5;

      if (!bucketName || !region) {
        return res.status(500).json({ error: "AWS configuration missing" });
      }

      const consultation = await Consultation.findById(consultationId)
        .select("uploads updatedAt")
        .lean()
        .maxTimeMS(3000);

      if (!consultation) {
        return res.status(404).json({ error: "Consultation not found" });
      }

      // SAFE fallback (fix TS + runtime crash)
      const uploads = (consultation as any).uploads ?? [];

      if (uploads.length >= MAX_UPLOADS) {
        return res.status(400).json({
          error: `Maximum upload limit of ${MAX_UPLOADS} files reached`,
          currentCount: uploads.length,
        });
      }

      const fileName = generateS3Key("consultations", req.file.originalname);
      const s3 = getS3Client();

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }),
      );

      const fileUrl = getFileUrl(bucketName, region, fileName);

      const newUpload = {
        id: uuidv4(),
        url: fileUrl,
        description: (description as string) || "",
        discussion: [],
        activeDiscussion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedConsultation = await Consultation.findByIdAndUpdate(
        consultationId,
        {
          $push: { uploads: newUpload },
          $set: { updatedAt: new Date() },
        },
        {
          new: true,
          lean: true,
          maxTimeMS: 5000,
        },
      );

      if (!updatedConsultation) {
        return res.status(404).json({ error: "Failed to update consultation" });
      }

      const updatedUploads = (updatedConsultation as any).uploads ?? [];
      const duration = Date.now() - startTime;

      // ✅ ALWAYS RETURN (fix TS2366)
      return res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: {
          upload: newUpload,
          uploadsCount: updatedUploads.length,
          uploadsRemaining: MAX_UPLOADS - updatedUploads.length,
          consultationId: updatedConsultation._id,
          processingTime: `${duration}ms`,
        },
      });
    } catch (error) {
      console.error("File upload error:", error);

      return res.status(500).json({
        error: "File upload failed",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

// Health check endpoint
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

export default router;
