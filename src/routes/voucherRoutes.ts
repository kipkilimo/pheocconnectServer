import express, { Request, Response } from "express";
import mongoose from "mongoose";
import pdf from "html-pdf-node";
import QRCode from "qrcode";
import dotenv from "dotenv";
import cors from "cors";

import { sendEmail, EmailOptions } from "../utils/emailHandler";
import Vendor from "../models/Vendor";

dotenv.config();

const router = express.Router();
router.use(cors());

const ngrokURL = "https://nembio.com";

const generateToken = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const generateQrCodeImage = async (token: string): Promise<string> => {
  const url = `${ngrokURL}:4000/vendors/check?code=${token}`;
  return QRCode.toDataURL(url);
};

const generatePdfBuffer = async (htmlContent: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    pdf.generatePdf(
      { content: htmlContent },
      { format: "A4" },
      (err, buffer) => {
        if (err) return reject(err);
        resolve(buffer);
      },
    );
  });
};

export const sendVouchersToEmails = async (emailList: string[]) => {
  for (const email of emailList) {
    const token = generateToken();

    const voucher = new Voucher({
      token,
      redeemed: false,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await voucher.save();

    const qrCodeUrl = await generateQrCodeImage(token);

    const html = `
      <div style="font-family: Arial; text-align:center;">
        <h2>YOUR VOUCHER</h2>
        <img src="${qrCodeUrl}" width="300"/>
        <p>Token: ${token}</p>
      </div>
    `;

    const pdfBuffer = await generatePdfBuffer(html);

    // ✅ FIXED EmailOptions (Brevo compatible)
    const emailOptions: EmailOptions = {
      to: email,
      subject: "Your NEMBio Voucher",
      text: "Your voucher is attached below.",
      html: "<p>Please find your voucher attached.</p>",
      attachments: [
        {
          filename: "voucher.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await sendEmail(emailOptions);

    console.log(`✅ Sent voucher to ${email}`);
  }
};

/**
 * Mongo Model
 */
interface IVoucher extends mongoose.Document {
  token: string;
  redeemed: boolean;
  expiryDate: string;
}

const voucherSchema = new mongoose.Schema<IVoucher>({
  token: { type: String, required: true },
  redeemed: { type: Boolean, default: false },
  expiryDate: { type: String, required: true },
});

const Voucher = mongoose.model<IVoucher>("Voucher", voucherSchema);

/**
 * ROUTES
 */

router.get("/send-vouchers", async (req: Request, res: Response) => {
  try {
    const emailList = JSON.parse(req.query.awardeeEmails as string);

    await sendVouchersToEmails(emailList);

    res.json({ message: "Vouchers sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to send vouchers.");
  }
});

export default router;
