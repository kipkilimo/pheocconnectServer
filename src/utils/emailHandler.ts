// utils/emailHandler.ts

export interface EmailAttachment {
  filename: string;
  content: Buffer | string; // make this required if you're sending
  contentType?: string;
}

/**
 * Sends an email using Brevo HTTP API directly
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  htmlContent: string,
  attachments?: EmailAttachment[],
): Promise<boolean> => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("❌ BREVO_API_KEY is not set");
      return false;
    }

    const recipients = Array.isArray(to) ? to : [to];

    const payload: any = {
      sender: {
        email: process.env.BREVO_FROM_EMAIL || "info@pheocconnect.org",
        name: process.env.BREVO_FROM_NAME || "PHEOCConnect",
      },
      to: recipients.map((email) => ({
        email,
        name: email.split("@")[0],
      })),
      subject,
      htmlContent,
      textContent: htmlContent.replace(/<[^>]*>/g, "").slice(0, 500),
    };

    // ✅ Attachments support (FIX)
    if (attachments?.length) {
      payload.attachment = attachments.map((file) => ({
        name: file.filename,
        content:
          typeof file.content === "string"
            ? Buffer.from(file.content).toString("base64")
            : file.content.toString("base64"),
        type: file.contentType,
      }));
    }

    // ❌ Removed reply-to (as requested: autos only)

    if (process.env.BREVO_CC_EMAIL) {
      payload.cc = [{ email: process.env.BREVO_CC_EMAIL }];
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Brevo API error:", error);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Email sent to ${recipients.length} recipient(s)`);

    if (process.env.NODE_ENV !== "production") {
      console.log(`   Message ID: ${data.messageId}`);
    }

    return true;
  } catch (error: any) {
    console.error("❌ Email sending failed:", error.message);
    return false;
  }
};
