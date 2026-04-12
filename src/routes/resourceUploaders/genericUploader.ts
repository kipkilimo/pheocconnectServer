// routes/resourceUploaders/genericUploader.ts
import express, { Request, Response } from "express";
import Resource from "../../models/Resource";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const router = express.Router();
const coverImageLimit = 2 * 1024 * 1024; // 2MB
const contentArrayLimit = 720 * 1024 * 1024; // 720MB

const coverImageUpload = multer({
  limits: { fileSize: coverImageLimit },
});

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

// Generic upload endpoint
router.post("/", async (req: Request, res: Response) => {
  const resourceId = req.query.resourceId as string;
  const fileCreationStage = req.query.fileCreationStage as string;
  const fileCount =
    fileCreationStage === "COVER"
      ? 1
      : fileCreationStage === "CONTENT"
        ? 10
        : 0;

  if (fileCount === 0) {
    return res.status(400).send("Invalid fileCreationStage parameter.");
  }

  const uploadHandler =
    fileCreationStage === "COVER"
      ? coverImageUpload.single("file")
      : contentUpload.array("files", fileCount);

  uploadHandler(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).send("File size limit exceeded.");
        }
        return res.status(400).send(`Multer error: ${err.message}`);
      }
      return res.status(400).send(`Error uploading files: ${err.message}`);
    }

    const files =
      fileCreationStage === "COVER"
        ? [req.file]
        : (req.files as Express.Multer.File[]);

    if (!files || files.length === 0) {
      return res.status(400).send("No files uploaded.");
    }

    try {
      const uploadPromises = files.map(async (file: any) => {
        const fileName = `${uuidv4()}-${file.originalname}`;
        const bucketName = process.env.AWS_BUCKET_NAME as string;

        const uploadParams = {
          Bucket: bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      });

      const fileUrls = await Promise.all(uploadPromises);

      if (!resourceId) {
        return res.status(400).send("Resource ID is required.");
      }

      if (fileCreationStage === "COVER") {
        const updatedResource = await Resource.findByIdAndUpdate(
          resourceId,
          { coverImage: fileUrls[0] },
          { new: true },
        );
        if (!updatedResource) {
          return res.status(404).send("Resource not found.");
        }
        res.json({
          message: "Cover image uploaded successfully",
          resource: updatedResource,
        });
      } else if (fileCreationStage === "CONTENT") {
        const updatedResource = await Resource.findByIdAndUpdate(
          resourceId,
          { content: JSON.stringify(fileUrls) },
          { new: true },
        );
        if (!updatedResource) {
          return res.status(404).send("Resource not found.");
        }
        res.json({
          message: "Files uploaded successfully",
          url: JSON.stringify(fileUrls),
        });
      }
    } catch (error) {
      console.error("Error uploading files to S3:", error);
      res.json({ message: "Error uploading files" });
    }
  });
});

export default router;
