// utils/emailHandler.ts
import nodemailer from "nodemailer";

/**
 * Email attachment type
 */
export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
  encoding?: string;
}

/**
 * Main Email Options (THIS WAS MISSING BEFORE)
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sends email using Brevo SMTP via Nodemailer
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${process.env.APP_NAME || "NEMBio"}" <${process.env.MAIL_FROM}>`,
      replyTo: process.env.MAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (options.attachments?.length) {
      mailOptions.attachments = options.attachments.map((a) => {
        if (a.path) {
          return {
            filename: a.filename,
            path: a.path,
            contentType: a.contentType,
          };
        }

        return {
          filename: a.filename,
          content: a.content,
          contentType: a.contentType || "application/octet-stream",
          encoding: a.encoding,
        };
      });
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent via Brevo:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Brevo email error:", error);
    return false;
  }
};
