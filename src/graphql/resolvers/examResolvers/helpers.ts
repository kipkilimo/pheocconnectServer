import { Types } from "mongoose";
import User from "../../../models/User";
import { LeanExam } from "./types";
import crypto from "crypto";
import {
  sendEmail,
  EmailOptions,
  EmailAttachment,
} from "../../../utils/emailHandler";
import Exam from "../../../models/Exam";

// Helper function to check if a string is a valid MongoDB ObjectId
export function isValidObjectId(id: string): boolean {
  // Check if it's a 24-character hex string
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export const transformExam = (exam: any) => {
  if (!exam) return null;

  return {
    ...exam,
    id: exam._id?.toString(),
    _id: exam._id?.toString(),
    examDate: exam.examDate?.toISOString(),
    createdAt: exam.createdAt?.toISOString(),

    participants:
      exam.participants?.map((p: any) => ({
        userId: p.userId,
        name: p.name || p.personalInfo?.fullName,
        emailAddress: p.emailAddress || p.personalInfo?.email,
        courseTaken: p.courseTaken,
        level: p.level,
        registeredAt: p.registeredAt?.toISOString(),
        responses: p.responses || "",
        status: p.status || "PENDING",
        approvalToken: p.approvalToken,
        registeredVia: p.registeredVia,
        approvedAt: p.approvedAt?.toISOString(),
      })) || [],

    examPreRegistrationDetails:
      exam.examPreRegistrationDetails?.map((p: any) => ({
        userId: p.userId,
        name: p.name,
        emailAddress: p.emailAddress,
        courseTaken: p.courseTaken,
        level: p.level,
        registeredAt: p.registeredAt?.toISOString(),
        responses: p.responses || "",
        status: p.status || "PENDING",
        approvalToken: p.approvalToken,
        registeredVia: p.registeredVia,
        approvedAt: p.approvedAt?.toISOString(),
      })) || [],

    questions:
      exam.questions?.map((q: any) => ({
        id: q._id || q.id,
        shortId: q.shortId,
        stem: q.stem,
        questionType: q.questionType,
        difficulty: q.difficulty,
        choices: q.choices,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
        specialty: q.specialty,
        topic: q.topic,
        createdAt: q.createdAt?.toISOString(),
        metrics: q.metrics,
      })) || [],

    createdBy: {
      id: exam.createdBy?._id?.toString() || exam.createdBy?.toString(),
      personalInfo: exam.createdBy?.personalInfo || {
        username: exam.createdBy?.username,
        fullName: exam.createdBy?.fullName,
        email: exam.createdBy?.email,
      },
    },
  };
};

// Helper to get convener details - using personalInfo only
export const getConvenerDetails = async (userId: string) => {
  const user = await User.findById(userId).lean<any>();
  if (!user) throw new Error("Convener not found");
  return {
    email: user.personalInfo?.email || "Not set",
    name: user.personalInfo?.fullName || "Exam Convener",
  };
};

// Encryption/Decryption helpers
export function encryptData(data: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || "default-key-32-chars-long!!!",
    "salt",
    32,
  );
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptData(encryptedData: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || "default-key-32-chars-long!!!",
    "salt",
    32,
  );

  const [ivHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Email helper functions with proper styling (PDF kit and email styles)
export async function sendPendingApprovalEmail(options: {
  email: string;
  name: string;
  examTitle: string;
  examDate: Date;
  convenerName?: string;
  convenerEmail?: string;
}): Promise<boolean> {
  const theme = {
    colors: {
      primary: "#2A73C5",
      secondary: "#5E60CE",
      success: "#2EBD85",
      warning: "#F4B740",
      error: "#E05658",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#1A2C3E",
      textMuted: "#6C757D",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pending Approval - NEMBio Session</title>
<style>
  body {
    margin:0;
    padding:0;
    background:${theme.colors.background};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  }
  .container {
    max-width:600px;
    margin:0 auto;
    background:${theme.colors.surface};
    border-radius:12px;
    overflow:hidden;
  }
</style>
</head>
<body>
  <div style="padding:20px 12px;">
    <div class="container">
      <!-- Header -->
      <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
        <img 
          src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
          alt="NEMBio Logo"
          style="width:180px; max-width:70%; height:auto;"
        />
      </div>
      
      <!-- Content -->
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px; font-size:20px; color:${theme.colors.text};">
          Hello ${options.name},
        </h2>
        
        <p style="margin:0 0 16px; font-size:14px; color:${theme.colors.textMuted};">
          Your registration for <strong>${options.examTitle}</strong> has been received and is pending approval.
        </p>
        
        <div style="background:#FFFBF4; border-left:4px solid ${theme.colors.warning}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
          <p style="margin:0; font-size:13px;">
            📅 <strong>Session Date:</strong> ${new Date(options.examDate).toLocaleString()}
          </p>
          <p style="margin:8px 0 0; font-size:13px;">
            ⏳ <strong>Status:</strong> Pending Approval
          </p>
        </div>
        
        <p style="margin:0 0 12px; font-size:13px; color:${theme.colors.textMuted};">
          You will receive an email once your registration is approved. The session convener has been notified.
        </p>
        
        <div style="background:#e8f0fe; border-radius:6px; padding:12px; margin-bottom:16px;">
          <p style="margin:0; font-size:12px; color:#1a3c6e;">
            💡 <strong>Next Steps:</strong> Wait for approval. You'll receive access instructions via email.
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="text-align:center; padding:20px 24px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
        <div>NEMBio Learning - Epidemiology • Biostatistics • Research Methods</div>
        <div style="margin-top:8px;">Nairobi, KE | Tel: +254 700 378 241 | Email: info@nembio.com</div>
        <div style="margin-top:8px;">© ${new Date().getFullYear()} NEMBio Learning. All rights reserved.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `Pending Approval: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

export async function sendApprovalEmail(options: {
  email: string;
  name: string;
  examTitle: string;
  examDate: Date;
  examUrl: string;
  accessKey: string;
  sessionId: string;
}): Promise<boolean> {
  const theme = {
    colors: {
      primary: "#2A73C5",
      success: "#2EBD85",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#1A2C3E",
      textMuted: "#6C757D",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registration Approved - NEMBio Session</title>
<style>
  body {
    margin:0;
    padding:0;
    background:${theme.colors.background};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  }
  .container {
    max-width:600px;
    margin:0 auto;
    background:${theme.colors.surface};
    border-radius:12px;
    overflow:hidden;
  }
  .button {
    display:inline-block;
    padding:12px 24px;
    background:${theme.colors.primary};
    color:white;
    text-decoration:none;
    border-radius:6px;
    font-weight:500;
  }
</style>
</head>
<body>
  <div style="padding:20px 12px;">
    <div class="container">
      <!-- Header -->
      <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
        <img 
          src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
          alt="NEMBio Logo"
          style="width:180px; max-width:70%; height:auto;"
        />
      </div>
      
      <!-- Content -->
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px; font-size:20px; color:${theme.colors.text};">
          Congratulations ${options.name}! 🎉
        </h2>
        
        <p style="margin:0 0 16px; font-size:14px; color:${theme.colors.textMuted};">
          Your registration for <strong>${options.examTitle}</strong> has been approved.
        </p>
        
        <div style="background:#e8f8f0; border-left:4px solid ${theme.colors.success}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
          <p style="margin:0 0 8px; font-size:13px;">
            📅 <strong>Session Date:</strong> ${new Date(options.examDate).toLocaleString()}
          </p>
          <p style="margin:0 0 8px; font-size:13px;">
            🔑 <strong>Access Key:</strong> ${options.accessKey}
          </p>
          <p style="margin:0; font-size:13px;">
            🆔 <strong>Session ID:</strong> ${options.sessionId}
          </p>
        </div>
        
        <div style="text-align:center; margin-bottom:20px;">
          <a href="${options.examUrl}" class="button" style="color:white; text-decoration:none;">
            Access Your Session
          </a>
        </div>
        
        <div style="background:#e8f0fe; border-radius:6px; padding:12px;">
          <p style="margin:0; font-size:12px; color:#1a3c6e;">
            💡 <strong>Note:</strong> This link is unique to you and will expire after the session date.
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="text-align:center; padding:20px 24px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
        <div>NEMBio Learning - Epidemiology • Biostatistics • Research Methods</div>
        <div style="margin-top:8px;">© ${new Date().getFullYear()} NEMBio Learning. All rights reserved.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `Registration Approved: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

export async function notifyExamConvener(options: {
  email: string;
  name: string;
  examTitle: string;
  participantName: string;
  participantEmail: string;
  registrationUrl: string;
}): Promise<boolean> {
  const theme = {
    colors: {
      primary: "#2A73C5",
      warning: "#F4B740",
      background: "#F5F7FA",
      surface: "#FFFFFF",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Registration - NEMBio Session</title>
</head>
<body style="margin:0; padding:20px; background:${theme.colors.background}; font-family: Arial, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:${theme.colors.surface}; border-radius:12px; overflow:hidden;">
    <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
      <img 
        src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
        alt="NEMBio Logo"
        style="width:180px;"
      />
    </div>
    
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px; color:#1A2C3E;">Hello ${options.name},</h2>
      
      <p style="margin:0 0 16px; color:#6C757D;">
        A new participant has registered for <strong>${options.examTitle}</strong>.
      </p>
      
      <div style="background:#FFFBF4; border-left:4px solid ${theme.colors.warning}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
        <p style="margin:0 0 8px;"><strong>Participant Details:</strong></p>
        <p style="margin:0 0 4px;">👤 Name: ${options.participantName}</p>
        <p style="margin:0;">📧 Email: ${options.participantEmail}</p>
      </div>
      
      <div style="text-align:center;">
        <a href="${options.registrationUrl}" style="display:inline-block; padding:12px 24px; background:#2A73C5; color:white; text-decoration:none; border-radius:6px;">
          Review Registrations
        </a>
      </div>
    </div>
    
    <div style="text-align:center; padding:20px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
      <div>© ${new Date().getFullYear()} NEMBio Learning</div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `New Registration: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

export function generateExamAccessUrl(options: {
  sessionId: string;
  accessKey: string;
  email: string;
  expiresAt: Date;
}): string {
  const payload = JSON.stringify({
    sessionId: options.sessionId,
    accessKey: options.accessKey,
    email: options.email,
    exp: options.expiresAt.getTime(),
  });

  const encrypted = encryptData(payload);
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:8000";

  return `${baseUrl}/exam-access?token=${encodeURIComponent(encrypted)}`;
}

export async function sendRejectionEmail(options: {
  email: string;
  name: string;
  examTitle: string;
}): Promise<boolean> {
  const theme = {
    colors: {
      error: "#E05658",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#1A2C3E",
      textMuted: "#6C757D",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registration Update - NEMBio Session</title>
</head>
<body style="margin:0; padding:20px; background:${theme.colors.background}; font-family: Arial, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:${theme.colors.surface}; border-radius:12px; overflow:hidden;">
    <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
      <img 
        src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
        alt="NEMBio Logo"
        style="width:180px;"
      />
    </div>
    
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px; color:${theme.colors.text};">Hello ${options.name},</h2>
      
      <div style="background:#feefef; border-left:4px solid ${theme.colors.error}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
        <p style="margin:0; color:#721c24;">
          We regret to inform you that your registration for <strong>${options.examTitle}</strong> has been declined.
        </p>
      </div>
      
      <p style="margin:0 0 12px; color:${theme.colors.textMuted}; font-size:13px;">
        This could be due to session capacity limits or registration criteria. Please contact the session convener for more information.
      </p>
      
      <p style="margin:0; color:${theme.colors.textMuted}; font-size:13px;">
        Thank you for your interest in NEMBio Learning.
      </p>
    </div>
    
    <div style="text-align:center; padding:20px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
      <div>© ${new Date().getFullYear()} NEMBio Learning</div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `Registration Update: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

export async function sendSessionOpenEmail(options: {
  email: string;
  name: string;
  examTitle: string;
  examDate: Date;
  examUrl: string;
  accessKey: string;
  sessionId: string;
}): Promise<boolean> {
  return sendApprovalEmail(options); // Reuse approval email template
}

export async function sendWaitingListConfirmationEmail(options: {
  email: string;
  name: string;
  examTitle: string;
  position: number;
}): Promise<boolean> {
  const theme = {
    colors: {
      info: "#3AB0FF",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#1A2C3E",
      textMuted: "#6C757D",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Waiting List Confirmation - NEMBio Session</title>
</head>
<body style="margin:0; padding:20px; background:${theme.colors.background}; font-family: Arial, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:${theme.colors.surface}; border-radius:12px; overflow:hidden;">
    <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
      <img 
        src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
        alt="NEMBio Logo"
        style="width:180px;"
      />
    </div>
    
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px; color:${theme.colors.text};">Hello ${options.name},</h2>
      
      <div style="background:#e8f0fe; border-left:4px solid ${theme.colors.info}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
        <p style="margin:0 0 8px;">
          You have been added to the waiting list for <strong>${options.examTitle}</strong>.
        </p>
        <p style="margin:0;">
          📍 <strong>Your position:</strong> #${options.position} on the waiting list
        </p>
      </div>
      
      <p style="margin:0 0 12px; color:${theme.colors.textMuted}; font-size:13px;">
        You'll be notified via email if a spot becomes available. Thank you for your patience.
      </p>
    </div>
    
    <div style="text-align:center; padding:20px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
      <div>© ${new Date().getFullYear()} NEMBio Learning</div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `Waiting List: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}

export async function sendSessionReminderEmail(options: {
  email: string;
  name: string;
  examTitle: string;
  examDate: Date;
  examUrl: string;
  accessKey: string;
  sessionId: string;
}): Promise<boolean> {
  const theme = {
    colors: {
      primary: "#2A73C5",
      warning: "#F4B740",
      background: "#F5F7FA",
      surface: "#FFFFFF",
      text: "#1A2C3E",
      textMuted: "#6C757D",
    },
  };

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Reminder - NEMBio Learning</title>
</head>
<body style="margin:0; padding:20px; background:${theme.colors.background}; font-family: Arial, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:${theme.colors.surface}; border-radius:12px; overflow:hidden;">
    <div style="text-align:center; padding:22px 20px; border-bottom:1px solid #eef0f2;">
      <img 
        src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
        alt="NEMBio Logo"
        style="width:180px;"
      />
    </div>
    
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px; color:${theme.colors.text};">Reminder: ${options.examTitle}</h2>
      
      <p style="margin:0 0 16px; color:${theme.colors.textMuted};">
        Hello ${options.name}, this is a reminder about your upcoming session.
      </p>
      
      <div style="background:#FFFBF4; border-left:4px solid ${theme.colors.warning}; padding:12px 14px; border-radius:6px; margin-bottom:16px;">
        <p style="margin:0 0 8px;">📅 <strong>Date:</strong> ${new Date(options.examDate).toLocaleString()}</p>
        <p style="margin:0 0 8px;">🔑 <strong>Access Key:</strong> ${options.accessKey}</p>
        <p style="margin:0;">🆔 <strong>Session ID:</strong> ${options.sessionId}</p>
      </div>
      
      <div style="text-align:center;">
        <a href="${options.examUrl}" style="display:inline-block; padding:12px 24px; background:${theme.colors.primary}; color:white; text-decoration:none; border-radius:6px;">
          Access Session
        </a>
      </div>
    </div>
    
    <div style="text-align:center; padding:20px; font-size:12px; color:#a0a4aa; border-top:1px solid #eef0f2;">
      <div>© ${new Date().getFullYear()} NEMBio Learning</div>
    </div>
  </div>
</body>
</html>`;

  const emailOptions: EmailOptions = {
    to: options.email,
    subject: `Reminder: ${options.examTitle} - NEMBio Learning`,
    html: emailHtml,
  };

  return await sendEmail(emailOptions);
}
