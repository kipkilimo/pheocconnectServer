import QRCode from "qrcode";
import * as fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import { sendEmail, EmailOptions } from "../../../utils/emailHandler";
import Paper from "../../../models/Paper";
import User from "../../../models/User";
import mongoose from "mongoose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// -------------------------------------
// Paths for QR code generation
// -------------------------------------
const ROOT_DIR = process.cwd();
const ASSETS_DIR = path.join(ROOT_DIR, "assets");

// Singleton S3 client
let s3Client: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
      },
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 5000,
        socketTimeout: 10000,
      },
    });
  }
  return s3Client;
};

export const generateS3Key = (prefix: string, fileName: string): string => {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${prefix}/${uuidv4()}-${sanitizedName}`;
};

export const getFileUrl = (
  bucketName: string,
  region: string,
  key: string,
): string => `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

/**
 * Ensure directory exists (kept for backward compatibility)
 */
export async function ensureDir(dir: string) {
  await fsPromises.mkdir(dir, { recursive: true });
}

/**
 * Reset temp directory (kept for backward compatibility)
 */
export async function resetTempDir(dir: string) {
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
    await fsPromises.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error("Temp dir reset failed:", err);
  }
}

/**
 * Check if file exists
 */
export async function fileExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate QR code as Data URL for email inline display
 */
export async function generateQRCodeDataUrl(url: string): Promise<string> {
  return await QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: {
      dark: "#2A73C5",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generate QR code buffer with high error correction for logo overlay
 */
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return await QRCode.toBuffer(url, {
    width: 750,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#2A73C5",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generate PDF as buffer for S3 upload (replaces file-based version)
 */
export async function generatePaperQRCodePDFBuffer(data: {
  title: string;
  sessionId: string;
  accessKey: string;
  createdDate: Date;
  requiresAuth: boolean;
  sessionStartTime?: string;
  joinUrl: string;
}): Promise<Buffer> {
  const {
    title,
    sessionId,
    accessKey,
    createdDate,
    requiresAuth,
    sessionStartTime,
    joinUrl,
  } = data;

  // Clean title
  const cleanTitle = title.replace(/^\u200B/, "").trim();

  const logoPath = path.join(ASSETS_DIR, "logo.png");
  const [hasLogo, qrBuffer] = await Promise.all([
    fileExists(logoPath),
    generateQRCodeBuffer(joinUrl),
  ]);

  return new Promise(async (resolve, reject) => {
    try {
      const buffers: Buffer[] = [];

      // Create PDF document
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Collect PDF data chunks
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const qrSize = Math.min(280, pageWidth * 0.5);
      const qrX = doc.page.margins.left + (pageWidth - qrSize) / 2;

      const formattedDate = createdDate.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const formatSessionDateTime = (
        date: string | undefined,
        locale = "en-US",
        options = {},
      ) => {
        const defaultOptions: Intl.DateTimeFormatOptions = {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        };

        if (!date) return undefined;

        const dateObj = new Date(date);

        // Check if the date is valid
        if (isNaN(dateObj.getTime())) return undefined;

        return dateObj.toLocaleString(locale, {
          ...defaultOptions,
          ...options,
        });
      };

      const formattedSessionDate = formatSessionDateTime(sessionStartTime);
      const centerOptions: { align: "center"; width: number } = {
        align: "center",
        width: pageWidth,
      };

      // Header
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#1A2C3E")
        .text("Journal Club PaperDive™", centerOptions);

      doc.moveDown(0.5);

      doc
        .font("Helvetica")
        .fontSize(14)
        .fillColor("#2A73C5")
        .text(cleanTitle, {
          ...centerOptions,
          height: 40,
          ellipsis: true,
        });

      doc.moveDown(0.8);

      // Details Box
      const boxY = doc.y;
      const boxHeight = 85;
      doc
        .rect(doc.page.margins.left, boxY, pageWidth, boxHeight)
        .fillAndStroke("#F5F7FA", "#E2E8F0");

      let contentY = boxY + 12;

      doc.font("Helvetica").fontSize(10).fillColor("#1A2C3E");

      doc.text("Session ID:", doc.page.margins.left + 15, contentY);
      doc.text("Access Key:", doc.page.margins.left + 15, contentY + 20);
      doc.text("Created:", doc.page.margins.left + 15, contentY + 40);
      doc.text("Journal Club Date:", doc.page.margins.left + 15, contentY + 60);

      doc.font("Helvetica-Bold");

      doc.text(sessionId, doc.page.margins.left + 100, contentY, {
        width: 250,
        ellipsis: true,
      });
      if (requiresAuth) {
        doc.text(
          "Contact convener",
          doc.page.margins.left + 100,
          contentY + 20,
          {
            width: 250,
            ellipsis: true,
          },
        );
      } else {
        doc.text(accessKey, doc.page.margins.left + 100, contentY + 20, {
          width: 250,
          ellipsis: true,
        });
      }
      doc.text(formattedDate, doc.page.margins.left + 100, contentY + 40, {
        width: 250,
        ellipsis: true,
      });

      // Valid until (30 days from creation)
      doc.text(
        formattedSessionDate ? formattedSessionDate : "N/A",
        doc.page.margins.left + 100,
        contentY + 60,
        {
          width: 250,
        },
      );

      doc.y = boxY + boxHeight + 20;

      // QR Section
      const qrY = doc.y;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize });

      const centerX = qrX + qrSize / 2;

      // Add logo on top of QR if exists
      if (hasLogo) {
        const centerY = qrY + qrSize / 2;
        const logoSize = qrSize * 0.25;
        const baseRadius = logoSize / 2;

        doc.save();
        doc.circle(centerX, centerY, baseRadius + 4).fill("#FFFFFF");
        doc
          .circle(centerX, centerY, baseRadius + 2)
          .lineWidth(3)
          .stroke("#2A73C5");
        doc.restore();

        const logoBuffer = await fsPromises.readFile(logoPath);
        const { width: imgWidth, height: imgHeight } = sizeOf(logoBuffer);
        const scale = logoSize / Math.max(imgWidth, imgHeight);
        const displayWidth = imgWidth * scale;
        const displayHeight = imgHeight * scale;

        doc.save();
        doc.circle(centerX, centerY, baseRadius - 1).clip();
        doc.image(
          logoBuffer,
          centerX - displayWidth / 2,
          centerY - displayHeight / 2,
          { width: displayWidth, height: displayHeight },
        );
        doc.restore();
      }

      // Text below QR
      const left = doc.page.margins.left;
      const right = doc.page.margins.right;
      const width = doc.page.width - left - right;
      const textWidth = qrSize * 1.5;
      const textX = centerX - textWidth / 2;
      let y = qrY + qrSize + 20;

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#1A2C3E")
        .text("SCAN TO ACCESS PAPER", textX, y, {
          width: textWidth,
          align: "center",
        });

      y += 16;

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#2A73C5")
        .text(joinUrl, textX, y, {
          width: textWidth,
          align: "center",
          ellipsis: true,
        });

      y += 20;

      // Instructions
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#1A2C3E")
        .text("Instructions:", left, y);

      y += 15;

      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#4A5568")
        .text(
          [
            "1. Scan the QR code or use the link above",
            "2. Enter your email address to request access",
            "3. The paper creator will approve your request",
            "4. Receive your access link via email",
            "5. Join the collaborative annotation session",
          ].join("\n"),
          left + 10,
          y,
          { width: width - 10 },
        );

      const instructionsHeight = 5 * 10;
      y += instructionsHeight + 16;

      // Important Note
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#E05658")
        .text("Important:", left, y);

      y += 12;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6C757D")
        .text(
          "This QR code grants access for the intended recipient only. Do not share.",
          left,
          y,
          { width },
        );

      // Footer
      const footerY = doc.page.height - doc.page.margins.bottom - 22;
      doc
        .fillColor("#F8F9FA")
        .rect(left, footerY - 4, width, 22)
        .fill();

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .moveTo(left, footerY - 6)
        .lineTo(doc.page.width - right, footerY - 6)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6C757D")
        .text(
          "NEMBio Learning - Collaborative Paper Review & Discussion",
          left,
          footerY,
          { width, align: "center", lineBreak: false },
        );

      doc
        .fontSize(7.5)
        .fillColor("#A0A4AA")
        .text(
          "Nairobi, KE • +254 700 378 241 • info@nembio.com",
          left,
          footerY + 7,
          { width, align: "center", lineBreak: false },
        );

      doc
        .fontSize(7)
        .fillColor("#C0C4C9")
        .text(`© ${new Date().getFullYear()} NEMBio`, left, footerY + 13, {
          width,
          align: "center",
          lineBreak: false,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload PDF to S3 and return URL
 */
export async function uploadPDFToS3(
  pdfBuffer: Buffer,
  sessionId: string,
  title: string,
): Promise<string> {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (!bucketName || !region) {
    throw new Error("AWS configuration missing: BUCKET_NAME or REGION");
  }

  const s3 = getS3Client();
  const pdfKey = generateS3Key("paper-qr-codes", `paper-${sessionId}.pdf`);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      Metadata: {
        paperTitle: title || "",
        sessionId: sessionId,
        createdDate: new Date().toISOString(),
      },
    }),
  );

  return getFileUrl(bucketName, region, pdfKey);
}

/**
 * Send paper created email with QR code PDF attachment (updated for S3)
 */
export async function sendPaperCreatedEmailWithAttachment(options: {
  email: string;
  name: string;
  paperTitle: string;
  sessionId: string;
  accessKey: string;
  joinUrl: string;
  qrCodeUrl: string;
  createdDate: Date;
  sessionStartTime?: string;
}) {
  const requiresAuth = true;
  const tempDir = path.join(process.cwd(), "temp");
  const tempFilePath = path.join(
    tempDir,
    `paper_${options.sessionId}_${Date.now()}.pdf`,
  );

  try {
    // ============================================
    // ✅ 1. Generate PDF Buffer
    // ============================================
    const pdfBuffer = await generatePaperQRCodePDFBuffer({
      title: options.paperTitle,
      sessionId: options.sessionId,
      accessKey: options.accessKey,
      createdDate: options.createdDate,
      requiresAuth: requiresAuth,
      sessionStartTime: options.sessionStartTime,
      joinUrl: options.joinUrl,
    });

    // ============================================
    // ✅ 2. Save TEMP file (optional but requested)
    // ============================================
    await fsPromises.mkdir(tempDir, { recursive: true });
    await fsPromises.writeFile(tempFilePath, pdfBuffer);

    // ============================================
    // ✅ 3. Upload to S3
    // ============================================
    const pdfUrl = await uploadPDFToS3(
      pdfBuffer,
      options.sessionId,
      options.paperTitle,
    );

    console.log("[S3] Uploaded PDF:", pdfUrl);

    // ============================================
    // ✅ 4. Prepare Email
    // ============================================
    const cleanTitle = options.paperTitle.replace(/^\u200B/, "").trim();

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Paper Created</title>
<style>
  body { margin:0; padding:10px; background:#EFF3F8; font-family: Arial, sans-serif; }
  .container { max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; }
  .button { display:inline-block; padding:12px 24px; background:#2A73C5; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:bold; }
  .qr-code { max-width:180px; margin:10px auto; display:block; }
</style>
</head>

<body>
<div class="container">

  <div style="text-align:center; padding:14px; border-bottom:1px solid #EAF0F6;">
    <img src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png" width="130"/>
  </div>

  <div style="padding:16px;">
    <h2>Hello ${options.name},</h2>

    <p>🎉 Your collaborative paper has been created successfully!</p>

    <div style="text-align:center;">
      <img src="${options.qrCodeUrl}" class="qr-code"/>
    </div>

    <div style="background:#F9FDFF; padding:12px; border-radius:12px; border:1px solid #EAF1F7;">
      <p><strong>Title:</strong> ${cleanTitle}</p>
      <p><strong>Session ID:</strong> ${options.sessionId}</p>
      <p>
        <strong>${requiresAuth ? "Access:" : "Access Key:"}</strong>
        ${requiresAuth ? "Restricted access" : options.accessKey}
      </p>
      <p><strong>Created:</strong> ${options.createdDate.toLocaleString()}</p>
      <p>
        <strong>Link:</strong><br/>
        <a href="${options.joinUrl}">${options.joinUrl}</a>
      </p>
    </div>

    <div style="text-align:center; margin:20px 0;">
      <a href="${options.joinUrl}" class="button">Access Paper</a>
    </div>

    <div style="text-align:center; font-size:11px; color:#6A7C8F;">
      NEMBio Learning • Nairobi, KE
    </div>
  </div>
</div>
</body>
</html>`;

    // ============================================
    // ✅ 5. Send Email (use SAME buffer)
    // ============================================
    const emailOptions: EmailOptions = {
      to: options.email,
      subject: `📄 Paper Created: ${cleanTitle}`,
      html: emailHtml,
      attachments: [
        {
          filename: `paper_${options.sessionId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const emailSent = await sendEmail(emailOptions);

    if (emailSent) {
      console.log("[EMAIL] Sent:", options.email);
      console.log("[EMAIL] PDF URL:", pdfUrl);
    }

    return {
      success: emailSent,
      pdfUrl, // ✅ updated AWS URL returned
    };
  } catch (error) {
    console.error("[EMAIL ERROR]", error);
    throw error;
  } finally {
    // ============================================
    // ✅ 6. Cleanup TEMP file
    // ============================================
    try {
      await fsPromises.unlink(tempFilePath);
      console.log("[CLEANUP] Temp file deleted");
    } catch (err) {
      console.warn("[CLEANUP] Failed to delete temp file:", err);
    }
  }
}

/**
 * Send access granted email to collaborator
 */
export async function sendPaperAccessGrantedEmail(options: {
  email: string;
  name: string;
  paperTitle: string;
  sessionId: string;
  accessKey: string;
  joinUrl: string;
  grantedBy: string;
}) {
  const requiresAuth = true;
  const cleanTitle = options.paperTitle.replace(/^\u200B/, "").trim();

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Granted - NEMBio Paper</title>
<style>
  body {
    margin:0;
    padding:10px;
    background:#EFF3F8;
    font-family: Arial, sans-serif;
  }
  .container {
    max-width:600px;
    margin:0 auto;
    background:#fff;
    border-radius:16px;
    overflow:hidden;
  }
  .button {
    display:inline-block;
    padding:12px 24px;
    background:#2A73C5;
    color:#ffffff;
    text-decoration:none;
    border-radius:8px;
    font-weight:bold;
  }
</style>
</head>

<body>
<div class="container">
  <div style="text-align:center; padding:14px; border-bottom:1px solid #EAF0F6;">
    <img 
      src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
      width="130"
      style="height:auto;"
    />
  </div>

  <div style="padding:20px;">
    <h2 style="color:#1F2F40;">Access Granted! 🎉</h2>
    
    <p>Hello ${options.name},</p>
    
    <p><strong>${options.grantedBy}</strong> has granted you access to collaborate on:</p>
    
    <div style="background:#F9FDFF; padding:15px; border-radius:12px; border:1px solid #EAF1F7; margin:15px 0;">
      <p style="margin:0 0 8px;"><strong>Paper:</strong> ${cleanTitle}</p>
      <p style="margin:0 0 8px;"><strong>Session ID:</strong> ${options.sessionId}</p>
     <p style="margin:0;">
  <strong>${requiresAuth ? "Access:" : "Access Key:"}</strong>
  ${requiresAuth ? "Restricted access" : options.accessKey}
</p>
    </div>
    
    <div style="text-align:center; margin:20px 0;">
      <a href="${options.joinUrl}" class="button" style="color:#ffffff;">Access Paper Now</a>
    </div>
    
    <p style="font-size:12px; color:#6A7C8F;">
      You can now view, annotate, and collaborate on this paper. Join live sessions to review together!
    </p>
  </div>
</div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `📝 Access Granted: ${cleanTitle}`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

/**
 * Send access request notification to paper creator
 */
export async function sendAccessRequestNotification(options: {
  creatorEmail: string;
  creatorName: string;
  requesterName: string;
  requesterEmail: string;
  paperTitle: string;
  requiresAuth: boolean;
  paperId: string;
  requestId: string;
}) {
  const cleanTitle = options.paperTitle.replace(/^\u200B/, "").trim();
  const dashboardUrl = `${process.env.CLIENT_SIDE_URL || "http://localhost:8000"}/dashboard/papers/${options.paperId}/requests`;

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Request - NEMBio Paper</title>
<style>
  body {
    margin:0;
    padding:10px;
    background:#EFF3F8;
    font-family: Arial, sans-serif;
  }
  .container {
    max-width:600px;
    margin:0 auto;
    background:#fff;
    border-radius:16px;
    overflow:hidden;
  }
  .button {
    display:inline-block;
    padding:12px 24px;
    background:#2A73C5;
    color:#ffffff;
    text-decoration:none;
    border-radius:8px;
    font-weight:bold;
  }
</style>
</head>

<body>
<div class="container">
  <div style="text-align:center; padding:14px; border-bottom:1px solid #EAF0F6;">
    <img 
      src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
      width="130"
    />
  </div>
  
  <div style="padding:20px;">
    <h2 style="color:#1F2F40;">New Access Request</h2>
    
    <p>Hello ${options.creatorName},</p>
    
    <p><strong>${options.requesterName}</strong> (${options.requesterEmail}) has requested access to collaborate on:</p>
    
    <div style="background:#F9FDFF; padding:15px; border-radius:12px; border:1px solid #EAF1F7; margin:15px 0;">
      <p style="margin:0;"><strong>Paper:</strong> ${cleanTitle}</p>
    </div>
    
    <div style="text-align:center; margin:20px 0;">
      <a href="${dashboardUrl}" class="button" style="color:#ffffff;">Review Request</a>
    </div>
    
    <p style="font-size:12px; color:#6A7C8F;">
      Approve or deny this request from your paper dashboard.
    </p>
  </div>
</div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.creatorEmail,
    subject: `🔔 Access Request: ${cleanTitle}`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

// Export for backward compatibility (deprecated)
export async function generatePaperQRCodePDF(data: any): Promise<string> {
  console.warn(
    "[DEPRECATED] generatePaperQRCodePDF is deprecated. Use generatePaperQRCodePDFBuffer instead.",
  );
  const buffer = await generatePaperQRCodePDFBuffer(data);
  const tempPath = path.join(process.cwd(), "temp", `temp_${Date.now()}.pdf`);
  await fsPromises.mkdir(path.dirname(tempPath), { recursive: true });
  await fsPromises.writeFile(tempPath, buffer);
  return tempPath;
}
