// emailService.ts
import { readFileSync } from "fs";
import nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";

// Define the interface for email options
export interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
    cid: string;
    contentDisposition: string;
  }[];
}

// Define constants for Mailtrap API Token and email addresses
const TOKEN = process.env.MAILTRAP_TOKEN!;
const SENDER_EMAIL = "info@nembio.com";
const RECIPIENT_EMAIL = "<RECIPIENT@EMAIL.COM>";

// Create a transport using Mailtrap and Nodemailer
const transport = nodemailer.createTransport(
  MailtrapTransport({
    token: TOKEN,
  }),
);

// Function to send the email
export async function sendEmail({
  to,
  from,
  subject,
  text,
  html,
  attachments,
}: EmailOptions): Promise<void> {
  try {
    const mailOptions = {
      text,
      to: {
        address: to,
        name: "Recipient Name",
      },
      from: {
        address: from,
        name: "NEMBio Communication",
      },
      subject,
      html,
      attachments: attachments || [],
    };

    // Send the email
    // @ts-ignore
    const info = await transport.sendMail(mailOptions);
    console.log("Email sent:", info);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
