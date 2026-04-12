// resolvers/paperResolvers/utils.ts
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

// -------------------------------------
// Paths for QR code generation
// -------------------------------------
const ROOT_DIR = process.cwd();
const TMP_DIR = path.join(ROOT_DIR, "temp", "paper_qrcodes");
const ASSETS_DIR = path.join(ROOT_DIR, "assets");

/**
 * Ensure directory exists
 */
export async function ensureDir(dir: string) {
  await fsPromises.mkdir(dir, { recursive: true });
}

/**
 * Reset temp directory
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
 * Generate PDF with QR code for paper access
 */
export async function generatePaperQRCodePDF(data: {
  title: string;
  sessionId: string;
  accessKey: string;
  createdDate: Date;
  joinUrl: string;
}): Promise<string> {
  const { title, sessionId, accessKey, createdDate, joinUrl } = data;

  // Clean title
  const cleanTitle = title.replace(/^\u200B/, "").trim();

  // Ensure temp directory exists
  await ensureDir(TMP_DIR);
  await resetTempDir(TMP_DIR);

  const fileName = `paper_${sessionId}_${createdDate.toISOString().split("T")[0]}.pdf`;
  const filePath = path.join(TMP_DIR, fileName);

  const logoPath = path.join(ASSETS_DIR, "logo.png");
  const [hasLogo, qrBuffer] = await Promise.all([
    fileExists(logoPath),
    generateQRCodeBuffer(joinUrl),
  ]);

  // Create PDF document
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });

  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

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

  const centerOptions: { align: "center"; width: number } = {
    align: "center",
    width: pageWidth,
  };

  // Header
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#1A2C3E")
    .text("NEMBio Collaborative Paper", centerOptions);

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
  doc.text("Valid Until:", doc.page.margins.left + 15, contentY + 60);

  doc.font("Helvetica-Bold");

  doc.text(sessionId, doc.page.margins.left + 100, contentY, {
    width: 250,
    ellipsis: true,
  });
  doc.text(accessKey, doc.page.margins.left + 100, contentY + 20, {
    width: 250,
    ellipsis: true,
  });
  doc.text(formattedDate, doc.page.margins.left + 100, contentY + 40, {
    width: 250,
    ellipsis: true,
  });

  // Valid until (30 days from creation)
  const validUntil = new Date(createdDate);
  validUntil.setDate(validUntil.getDate() + 30);
  doc.text(
    validUntil.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
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

    const logoBuffer = fs.readFileSync(logoPath);
    const { width: imgWidth, height: imgHeight } = sizeOf(logoBuffer);
    const scale = logoSize / Math.max(imgWidth, imgHeight);
    const displayWidth = imgWidth * scale;
    const displayHeight = imgHeight * scale;

    doc.save();
    doc.circle(centerX, centerY, baseRadius - 1).clip();
    doc.image(
      fs.readFileSync(logoPath),
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
      "NEMBio Learning - Collaborative Paper Review & Annotation",
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

  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return filePath;
}

/**
 * Send paper created email with QR code PDF attachment
 */
export async function sendPaperCreatedEmailWithAttachment(options: {
  email: string;
  name: string;
  paperTitle: string;
  sessionId: string;
  accessKey: string;
  joinUrl: string;
  qrCodeUrl: string;
  pdfPath: string;
  createdDate: Date;
}) {
  try {
    const pdfBuffer = await fsPromises.readFile(options.pdfPath);
    const cleanTitle = options.paperTitle.replace(/^\u200B/, "").trim();

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEMBio Paper Created</title>
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
</style>
</head>

<body>
<div class="container">

  <!-- HEADER -->
  <div style="text-align:center; padding:14px 14px 10px; border-bottom:1px solid #EAF0F6;">
    <img 
      src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
      width="130"
      style="height:auto; display:block; margin:0 auto;"
    />
  </div>

  <!-- MAIN -->
  <div style="padding:16px 16px 14px;">

    <h2 style="font-size:20px; margin:0 0 6px; color:#1F2F40;">
      Hello ${options.name},
    </h2>

    <p style="font-size:14px; margin:0 0 12px; color:#4A5B6E;">
      🎉 Your collaborative paper has been created successfully!
    </p>

    <!-- DETAILS -->
    <div style="background:#F9FDFF; padding:12px; border-radius:12px; border:1px solid #EAF1F7; margin-bottom:12px;">
      <p style="margin:4px 0; font-size:13px;">
        <strong>Title:</strong> ${cleanTitle}
      </p> 
      <p style="margin:4px 0; font-size:13px;">
        <strong>Session ID:</strong> 
        <span style="color:#2A73C5;">${options.sessionId}</span>
      </p>
      <p style="margin:4px 0; font-size:13px;">
        <strong>Access Key:</strong> 
        <span style="color:#2A73C5;">${options.accessKey}</span>
      </p>
      <p style="margin:4px 0; font-size:13px;">
        <strong>Created:</strong> 
        ${options.createdDate.toLocaleString()}
      </p>
      <p style="margin:4px 0; font-size:13px;">
        <strong>Access Link:</strong><br/>
        <a href="${options.joinUrl}" style="color:#2A73C5; font-size:12px; word-break:break-all;">
          ${options.joinUrl}
        </a>
      </p>
    </div>

    <!-- NEXT STEPS -->
    <div style="background:#FFFBF4; padding:10px 12px; border-left:3px solid #F4B740; border-radius:10px; margin-bottom:10px;">
      <p style="margin:0 0 6px; font-size:13px; font-weight:bold;">Next Steps</p>
      <ul style="margin:0; padding-left:16px; font-size:12.5px;">
        <li style="margin-bottom:4px;">Share the QR code or link with collaborators</li>
        <li style="margin-bottom:4px;">Users request access via email</li>
        <li style="margin-bottom:4px;">Approve requests from your dashboard</li>
        <li style="margin-bottom:4px;">Start collaborative annotation session</li>
      </ul>
    </div>

    <!-- TIP -->
    <div style="background:#F0F9F4; padding:10px 12px; border-left:3px solid #2EBD85; border-radius:10px; margin-bottom:12px;">
      <p style="margin:0; font-size:12.5px;">
        💡 The QR code PDF is attached for easy sharing. You can also start a live session from your dashboard.
      </p>
    </div>

    <!-- FOOTER -->
    <div style="text-align:center; font-size:10.5px; color:#6A7C8F;">
      NEMBio Learning<br/>
      Nairobi, KE<br/>
      © ${new Date().getFullYear()}
    </div>

  </div>
</div>
</body>
</html>`;

    const emailOptions: EmailOptions = {
      to: options.email,
      subject: `📄 Collaborative Paper Created: ${cleanTitle}`,
      html: emailHtml,
      attachments: [
        {
          filename: `paper_${options.sessionId}_qr_code.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const emailSent = await sendEmail(emailOptions);

    if (emailSent) {
      console.log("[EMAIL] Paper created email sent to:", options.email);
      console.log("[EMAIL] PDF attachment path:", options.pdfPath);
    }

    return emailSent;
  } catch (error) {
    console.error("[EMAIL] Failed to send paper created email:", error);
    throw error;
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
      <p style="margin:0;"><strong>Access Key:</strong> ${options.accessKey}</p>
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
  paperId: string;
  requestId: string;
}) {
  const cleanTitle = options.paperTitle.replace(/^\u200B/, "").trim();
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:8000"}/dashboard/papers/${options.paperId}/requests`;

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Request - NEMBio Paper</title>
</head>
<body style="margin:0; padding:10px; background:#EFF3F8; font-family:Arial,sans-serif;">
<div style="max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden;">
  <div style="text-align:center; padding:14px; border-bottom:1px solid #EAF0F6;">
    <img src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png" width="130" />
  </div>
  
  <div style="padding:20px;">
    <h2 style="color:#1F2F40;">New Access Request</h2>
    
    <p>Hello ${options.creatorName},</p>
    
    <p><strong>${options.requesterName}</strong> (${options.requesterEmail}) has requested access to collaborate on:</p>
    
    <div style="background:#F9FDFF; padding:15px; border-radius:12px; border:1px solid #EAF1F7; margin:15px 0;">
      <p style="margin:0;"><strong>Paper:</strong> ${cleanTitle}</p>
    </div>
    
    <div style="text-align:center; margin:20px 0;">
      <a href="${dashboardUrl}" style="display:inline-block; padding:12px 24px; background:#2A73C5; color:#ffffff; text-decoration:none; border-radius:8px;">
        Review Request
      </a>
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
