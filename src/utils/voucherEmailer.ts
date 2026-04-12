import nodemailer from "nodemailer";
import pdf from "html-pdf-node";

const tokens = ["token1", "token2", "token3"]; // Sample tokens, replace with dynamic data

// Utility functions
const getQrCodeUrl = (token: string): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    token
  )}`;
};

const getDiscount = (index: number): number => {
  return index % 2 === 0 ? 50 : 75;
};

const getSaleType = (index: number): string => {
  return index % 2 === 0 ? "BIG SALE" : "SUPER SALE";
};

const getVoucherStyle = (index: number): string => {
  return index % 2 === 0
    ? "background-color: #f5f5f5; color: #000;"
    : "background-color: #f5a623; color: #fff;";
};

const generateVoucherHTML = (index: number): string => {
  const qrCodeUrl = getQrCodeUrl(tokens[index]);
  const discount = getDiscount(index);
  const saleType = getSaleType(index);
  const voucherStyle = getVoucherStyle(index);

  return `
    <div style="width: 300px; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); ${voucherStyle}">
      <div style="text-align: center;">
        <img src="${qrCodeUrl}" alt="QR Code" style="width: 150px; height: 150px; margin-bottom: 20px;" />
        <div>
          <h2>SAVE ${discount}% OFF</h2>
          <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">${saleType}</p>
        </div>
      </div>
    </div>
  `;
};

const sendEmailWithVoucher = async (email: string, voucherPDF: Buffer) => {
  let transporter = nodemailer.createTransport({
    service: "gmail", // Replace with your email service
    auth: {
      user: "your-email@gmail.com",
      pass: "your-email-password",
    },
  });

  let mailOptions = {
    from: '"Your Company" <your-email@gmail.com>',
    to: email,
    subject: "Your Exclusive Voucher",
    text: "Please find your exclusive voucher attached.",
    attachments: [
      {
        filename: "voucher.pdf",
        content: voucherPDF,
        contentType: "application/pdf",
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

export const sendVouchersToEmails = async (emailList: string[]) => {
  for (let i = 0; i < emailList.length; i++) {
    const email = emailList[i];
    const htmlContent = generateVoucherHTML(i);

    const pdfBuffer = await pdf.generatePdf(
      { content: htmlContent },
      { format: "A4" }
    );

    await sendEmailWithVoucher(email, pdfBuffer);
    console.log(`Sent voucher to ${email}`);
  }
};
