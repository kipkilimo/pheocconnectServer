// routes/resourceUploaders/presentationUploader.ts
import express, { Request, Response } from "express";
import Resource from "../../models/Resource";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { splitPdfToPng } from "../../utils/fileProcessing";
import convert from "libreoffice-convert";

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

async function convertPptToPdf(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.(ppt|pptx)$/, ".pdf");
  const pptBuffer = await fs.readFile(inputPath);
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    convert.convert(pptBuffer, ".pdf", undefined, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
  await fs.writeFile(outputPath, pdfBuffer);
  return outputPath;
}

// Slides/PPT upload and processing
router.post(
  "/slides",
  contentUpload.single("file"),
  async (req: Request, res: Response) => {
    const resourceId = req.query.resourceId as string;

    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const resource = await Resource.findById(resourceId).select("contentType");
    if (!resource) {
      return res.status(400).send("Invalid resource ID.");
    }

    if ((resource as any).contentType !== "PRESENTATION") {
      return res.status(400).send("Invalid resource type.");
    }

    const tempDir = path.join(__dirname, "../temp");
    const tempFilePath = path.join(
      tempDir,
      `${uuidv4()}-${req.file.originalname}`,
    );
    const fileType = path.extname(req.file.originalname).toLowerCase();

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(tempFilePath, req.file.buffer);

      let pdfFilePath = tempFilePath;
      if (fileType === ".ppt" || fileType === ".pptx") {
        pdfFilePath = await convertPptToPdf(tempFilePath);
      }

      const imagePaths = await splitPdfToPng(pdfFilePath);

      const uploadPromises = imagePaths.map(async (file) => {
        const fileName = `${uuidv4()}-${path.basename(file)}`;
        const fileBuffer = await fs.readFile(file);

        const uploadParams = {
          Bucket: process.env.AWS_BUCKET_NAME as string,
          Key: fileName,
          Body: fileBuffer,
          ContentType: "image/png",
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        return `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      });

      const s3URLs = await Promise.all(uploadPromises);

      const updatedResource = await Resource.findByIdAndUpdate(
        resourceId,
        { content: JSON.stringify(s3URLs) },
        { new: true },
      );

      if (!updatedResource) {
        return res.status(404).send("Resource not found.");
      }

      res.json({
        message: "Files processed and uploaded successfully.",
        imageUrls: s3URLs,
        numberOfImages: s3URLs.length,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send(`Error processing file. ${error}`);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  },
);

export default router;
