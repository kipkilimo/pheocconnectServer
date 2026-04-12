import { Request, Response, NextFunction } from "express";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { parse } from "url";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure the required environment variables are available
if (
  !process.env.AWS_ACCESS_KEY ||
  !process.env.AWS_SECRET_KEY ||
  !process.env.AWS_REGION
) {
  throw new Error("Missing required environment variables");
}

// Create S3 Client with credentials from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Helper function to normalize input into an array of URLs
function normalizeToArray(fileUrls: string | string[]): string[] {
  return typeof fileUrls === "string" ? [fileUrls] : fileUrls;
}

// Middleware function to delete files from S3
export async function s3Deleter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { fileUrls } = req.body;

  if (!fileUrls) {
    return res.status(400).send("fileUrls is required");
  }

  const urls = normalizeToArray(fileUrls);

  try {
    for (const fileUrl of urls) {
      const parsedUrl = parse(fileUrl);
      if (!parsedUrl.host || !parsedUrl.pathname) {
        throw new Error(`Invalid URL format: ${fileUrl}`);
      }

      const bucketName = parsedUrl.host.split(".")[0];
      const key = decodeURIComponent(parsedUrl.pathname.slice(1));

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`File deleted successfully: ${fileUrl}`);
    }
    res.send("Files deleted successfully");
  } catch (error) {
    console.error("Error deleting files:", error);
    res.status(500).send("An error occurred while deleting files");
  }
}
