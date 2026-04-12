import fs from "fs"; // Standard fs module for stream operations
import fsPromises from "fs/promises"; // fs/promises for async file operations
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import { Request, Response } from "express";
import Paper from "../models/Paper";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { PDFImage } from "pdf-image";
import os from "os";
import path from "path";

// Load environment variables
dotenv.config();

const { AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_BUCKET_NAME } =
  process.env;

if (!AWS_REGION || !AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_BUCKET_NAME) {
  throw new Error("Missing AWS configuration in environment variables.");
}

// Configure the AWS SDK
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

interface ImageObject {
  number: number;
  image: string;
}

const convertPdfToImages = async (
  pdfPath: string,
  outputPath: string,
  paperId: string
): Promise<void> => {
  try {
    await fsPromises.mkdir(outputPath, { recursive: true });

    const pdfImage = new PDFImage(pdfPath, {
      outputDirectory: outputPath,
      convertOptions: {
        "-quality": "100",
        "-density": "300",
      },
    });

    const imagePaths = await pdfImage.convertFile();
    console.log("PDF converted to images successfully.");

    const imageObjects: ImageObject[] = [];
    const bucketName = AWS_BUCKET_NAME;
    const region = AWS_REGION;

    for (let index = 0; index < imagePaths.length; index++) {
      const imagePath = imagePaths[index];
      try {
        const fileStream = fs.createReadStream(imagePath);
        const pageNumber = index + 1; // Page numbers are 1-based
        const fileName = `page-${pageNumber}-${uuidv4()}.jpeg`;

        const uploadParams = {
          Bucket: bucketName,
          Key: `pdf-images/${fileName}`,
          Body: fileStream,
          ContentType: "image/jpeg",
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        const imageUrl = `https://${uploadParams.Bucket}.s3.${region}.amazonaws.com/${uploadParams.Key}`;

        imageObjects.push({ number: pageNumber, image: imageUrl });

        // Clean up local file asynchronously
        await fsPromises.unlink(imagePath);
      } catch (err) {
        console.error(`Error uploading image ${imagePath}:`, err);
      }
    }

    const modelDocument = await Paper.findById(paperId);
    if (!modelDocument) {
      throw new Error("Document not found");
    }

    // Sort the imageObjects array by page number
    imageObjects.sort((a, b) => a.number - b.number);

    modelDocument.url = JSON.stringify(imageObjects);
    await modelDocument.save();

    console.log("Model updated with image URLs successfully.");
  } catch (error) {
    console.error("Error processing PDF:", error);
  } finally {
    try {
      // Clean up the output directory
      await fsPromises.rm(outputPath, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const handlePdfConversion = [
  upload.single("file"),
  async (req: Request, res: Response) => {
    const paperId = req.query.paperId as string;
    const file = req.file;

    if (!file) {
      return res.status(400).send({ error: "No file uploaded." });
    }

    // Generate a unique file name for the temporary PDF file
    const pdfPath = path.join(os.tmpdir(), `${uuidv4()}.pdf`);

    try {
      // Write the buffer to a temporary file
      await fsPromises.writeFile(pdfPath, file.buffer);

      // Define the output path for the images
      const outputPath = path.join(os.tmpdir(), `output-${uuidv4()}`);

      // Convert the PDF to images
      await convertPdfToImages(pdfPath, outputPath, paperId);

      // Clean up the temporary PDF file
      await fsPromises.unlink(pdfPath);

      // Fetch the updated document
      const updatedDocument = await Paper.findById(paperId);

      res.status(200).send({
        message: "PDF conversion and upload successful.",
        updatedPaper: updatedDocument,
      });
    } catch (error) {
      console.error("Error in handlePdfConversion:", error);
      res.status(500).send({ error: "Error converting PDF to images." });
    }
  },
];
