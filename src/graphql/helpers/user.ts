// src/utils/email.ts
import { emailFooter } from "../../utils/emailFooter";
import { emailHeader } from "../../utils/emailHeader";
import { sendEmail as sendEmailHandler } from "../../utils/emailHandler";
import { redisClient } from "../../utils/redis";

// Theme colors
const theme = {
  colors: {
    primary: "#2A73C5",
    secondary: "#5E60CE",
    success: "#2EBD85",
    warning: "#F4B740",
    error: "#E05658",
    background: "#F5F7FA",
    surface: "#FFFFFF",
  },
};

// OTP Configuration
const OTP_TTL_SECONDS = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 3;

// Redis Key Builder (multi-domain safe)
function otpKey(app: string, domain: string, email: string): string {
  return `otp:${app}:${domain}:${email}`;
}

// OTP Email Template
export const createOTPEmail = (
  otpCode: string,
  expiresInMinutes: number = 15,
) => {
  const backgroundColor = theme.colors.background;
  const surfaceColor = theme.colors.surface;
  const primaryColor = theme.colors.primary;
  const textColor = "#1A2C3E";
  const textMuted = "#6C757D";

  return `
<div style="margin:0; padding:0; background-color: ${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 16px;">
        
        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${surfaceColor}; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td>
              ${emailHeader}
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor}, ${theme.colors.secondary}); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">PHEOCConnect Login Verification</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Enter this code to complete your login</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              
              <!-- OTP Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: ${backgroundColor}; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 14px; color: ${textMuted}; margin-bottom: 12px;">Your verification code is:</div>
                    <div style="font-family: monospace; font-size: 48px; font-weight: 700; letter-spacing: 8px; color: ${primaryColor}; background: white; padding: 16px; border-radius: 8px; display: inline-block;">
                      ${otpCode}
                    </div>
                    <div style="margin-top: 16px; font-size: 12px; color: ${textMuted};">
                      This code expires in ${expiresInMinutes} minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Instructions -->
              <div style="color: ${textColor}; line-height: 1.6;">
                <p style="margin: 0 0 16px 0;">Copy this code and paste it into the verification screen to complete your login to PHEOCConnect.</p>
                <div style="background: ${backgroundColor}; padding: 12px; border-radius: 8px; border-left: 4px solid ${primaryColor}; margin: 16px 0;">
                  <strong style="color: ${primaryColor};">🔒 Security Tip:</strong>
                  <span style="color: ${textMuted}; font-size: 13px;"> Never share this code with anyone, including anyone claiming to be from support.</span>
                </div>
              </div>
              
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              ${emailFooter.replace(
                'style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;"',
                `style="background-color:${backgroundColor}; padding:16px; text-align:center; color:#7f8c8d; font-size:12px; border-top:1px solid #e9ecef;"`,
              )}
            </td>
          </tr>
        
        </table> <!-- end container -->
      
        </td>
    </tr>
   </table>
</div>
  `.trim();
};

// Welcome Email Template with OTP
// Welcome Email Template with OTP
export const createWelcomeEmail = (
  userName: string,
  role: string,
  otpCode: string,
  otpExpiresAt: Date,
) => {
  const backgroundColor = theme.colors.background;
  const surfaceColor = theme.colors.surface;
  const primaryColor = theme.colors.primary;
  const successColor = theme.colors.success;
  const textColor = "#1A2C3E";

  // Calculate expiration time for display
  const expiresInMinutes = Math.ceil(
    (otpExpiresAt.getTime() - Date.now()) / (1000 * 60),
  );

  return `
<div style="margin:0; padding:0; background-color: ${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 16px;">
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${surfaceColor}; border-radius: 12px; overflow: hidden;">
                    <!-- Header -->
          <tr>
            <td>
              ${emailHeader}
            </td>
          </tr>

          <!-- Hero Section -->
          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, ${successColor}, ${primaryColor}); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">Welcome to PHEOCConnect! 🎉</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Your account has been successfully created</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="color: ${textColor}; line-height: 1.6;">
                <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
                <p style="margin: 0 0 24px 0;">Thank you for joining PHEOCConnect! Your account has been created with the role: <strong style="color: ${primaryColor};">${role}</strong>.</p>
                
                <!-- OTP Section -->
                <div style="background: linear-gradient(135deg, ${backgroundColor}, ${surfaceColor}); padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; border: 2px dashed ${primaryColor}40;">
                  <h3 style="margin: 0 0 16px 0; color: ${primaryColor};">Your One-Time Password (OTP)</h3>
                  <div style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: ${primaryColor}; background: white; padding: 20px; border-radius: 8px; display: inline-block; font-family: monospace; margin: 16px 0;">
                    ${otpCode}
                  </div>
                  <p style="margin: 16px 0 0 0; font-size: 14px; color: #666;">
                    ⏰ This OTP will expire in <strong>${expiresInMinutes} minute${expiresInMinutes !== 1 ? "s" : ""}</strong>
                  </p>
                  <p style="margin: 8px 0 0 0; font-size: 13px; color: #999;">
                    Use this code to complete your login
                  </p>
                </div>
                
                <div style="background: ${backgroundColor}; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin: 0 0 12px 0; color: ${primaryColor};">How to Login</h3>
                  <ol style="margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;">Go to the PHEOCConnect login page</li>
                    <li style="margin: 8px 0;">Enter your email address</li>
                    <li style="margin: 8px 0;">Enter the OTP code: <strong>${otpCode}</strong></li>
                    <li style="margin: 8px 0;">Start using your account!</li>
                  </ol>
                </div>
                
                <div style="background: #FFF3CD; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #FFC107;">
                  <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>⚠️ Security Note:</strong> Never share this OTP with anyone. Our support team will never ask for your verification code.
                  </p>
                </div>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td>
              ${emailFooter.replace(
                'style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;"',
                `style="background-color:${backgroundColor}; padding:16px; text-align:center; color:#7f8c8d; font-size:12px; border-top:1px solid #e9ecef;"`,
              )}
            </td>
          </tr>
        
        </table>
      </td>
    </tr>
  </table>
</div>
  `.trim();
};

// Account Deactivation Email
export const createAccountDeactivationEmail = (
  userName: string,
  deactivatedBy: string,
) => {
  const backgroundColor = theme.colors.background;
  const surfaceColor = theme.colors.surface;
  const errorColor = theme.colors.error;
  const textColor = "#1A2C3E";

  return `
<div style="margin:0; padding:0; background-color: ${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 16px;">
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${surfaceColor}; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td>
              ${emailHeader}
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, ${errorColor}, #c0392b); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">PHEOCConnect Account Deactivated</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Your access has been suspended</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="color: ${textColor}; line-height: 1.6;">
                <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
                <p style="margin: 0 0 24px 0;">Your PHEOCConnect account has been deactivated by <strong>${deactivatedBy}</strong>.</p>
                
                <div style="background: ${backgroundColor}; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin: 0 0 12px 0; color: ${errorColor};">What does this mean?</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;">You can no longer log in to PHEOCConnect</li>
                    <li style="margin: 8px 0;">Your data remains in the system for audit purposes</li>
                    <li style="margin: 8px 0;">Contact an administrator to reactivate your account</li>
                  </ul>
                </div>
                
                <p style="margin: 24px 0 0 0;">If you believe this was a mistake, please reach out to your PHEOC administrator.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              ${emailFooter.replace(
                'style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;"',
                `style="background-color:${backgroundColor}; padding:16px; text-align:center; color:#7f8c8d; font-size:12px; border-top:1px solid #e9ecef;"`,
              )}
            </td>
          </tr>
        
        </table>
      </td>
    </tr>
  </table>
</div>
  `.trim();
};

// Role Change Notification Email
export const createRoleChangeEmail = (
  userName: string,
  oldRole: string,
  newRole: string,
  changedBy: string,
) => {
  const backgroundColor = theme.colors.background;
  const surfaceColor = theme.colors.surface;
  const primaryColor = theme.colors.primary;
  const textColor = "#1A2C3E";

  return `
<div style="margin:0; padding:0; background-color: ${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 16px;">
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${surfaceColor}; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td>
              ${emailHeader}
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryColor}, ${theme.colors.secondary}); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">PHEOCConnect Role Updated</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Your permissions have changed</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="color: ${textColor}; line-height: 1.6;">
                <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
                <p style="margin: 0 0 24px 0;">Your PHEOCConnect role has been updated by <strong>${changedBy}</strong>.</p>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: ${backgroundColor}; border-radius: 8px; padding: 16px; margin: 24px 0;">
                  <tr>
                    <td style="padding: 8px;">
                      <div style="font-size: 14px; color: #6C757D;">Previous Role</div>
                      <div style="font-size: 20px; font-weight: 700;">${oldRole}</div>
                    </td>
                    <td style="padding: 8px; text-align: center; font-size: 24px;">→</td>
                    <td style="padding: 8px;">
                      <div style="font-size: 14px; color: #6C757D;">New Role</div>
                      <div style="font-size: 20px; font-weight: 700; color: ${primaryColor};">${newRole}</div>
                    </td>
                  </tr>
                <tr>
                
                <p style="margin: 24px 0 0 0;">If you didn't expect this change or have questions, please contact your PHEOC administrator.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              ${emailFooter.replace(
                'style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;"',
                `style="background-color:${backgroundColor}; padding:16px; text-align:center; color:#7f8c8d; font-size:12px; border-top:1px solid #e9ecef;"`,
              )}
            </td>
          </tr>
        
        <tr>
      </td>
    </tr>
  </table>
</div>
  `.trim();
};

// Account Reactivation Email
export const createAccountReactivationEmail = (
  userName: string,
  reactivatedBy: string,
) => {
  const backgroundColor = theme.colors.background;
  const surfaceColor = theme.colors.surface;
  const successColor = theme.colors.success;
  const textColor = "#1A2C3E";

  return `
<div style="margin:0; padding:0; background-color: ${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 16px;">
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${surfaceColor}; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td>
              ${emailHeader}
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, ${successColor}, ${theme.colors.primary}); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">Account Reactivated</h1>
              <p style="margin: 0; opacity: 0.9; font-size: 16px;">Your access has been restored</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="color: ${textColor}; line-height: 1.6;">
                <p style="margin: 0 0 16px 0; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
                <p style="margin: 0 0 24px 0;">Your PHEOCConnect account has been reactivated by <strong>${reactivatedBy}</strong>.</p>
                
                <div style="background: ${backgroundColor}; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="margin: 0 0 12px 0; color: ${successColor};">✅ Account Restored</h3>
                  <p style="margin: 0;">You can now log in again and access all PHEOCConnect features.</p>
                </div>
                
                <p style="margin: 24px 0 0 0;">If you have any questions, please contact your administrator.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              ${emailFooter.replace(
                'style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;"',
                `style="background-color:${backgroundColor}; padding:16px; text-align:center; color:#7f8c8d; font-size:12px; border-top:1px solid #e9ecef;"`,
              )}
            </td>
          </tr>
        
        <tr>
      </td>
    </tr>
  </table>
</div>
  `.trim();
};

// Wrapper for sendEmail that uses your emailHandler
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; messageId?: string }> => {
  try {
    const success = await sendEmailHandler(to, subject, html);
    if (success) {
      console.log(`✅ Email sent to ${to}`);
      return { success: true, messageId: `sent-${Date.now()}` };
    } else {
      throw new Error("Email handler returned false");
    }
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw new Error("Failed to send email");
  }
};

// Generate OTP code (6 digits)
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Redis-based OTP Storage (No more Map!)
export const storeOTP = async (
  app: string,
  domain: string,
  email: string,
  code: string,
): Promise<void> => {
  const key = otpKey(app, domain, email);

  const payload = {
    code,
    attempts: 0,
  };

  await redisClient.set(key, JSON.stringify(payload), {
    EX: OTP_TTL_SECONDS,
  });
};

export const verifyStoredOTP = async (
  app: string,
  domain: string,
  email: string,
  code: string,
): Promise<boolean> => {
  const key = otpKey(app, domain, email);

  const raw = await redisClient.get(key);
  if (!raw) return false;

  const otpData = JSON.parse(raw) as {
    code: string;
    attempts: number;
  };

  // Too many attempts → delete
  if (otpData.attempts >= MAX_ATTEMPTS) {
    await redisClient.del(key);
    return false;
  }

  // Wrong OTP → increment attempts
  if (otpData.code !== code) {
    otpData.attempts += 1;

    await redisClient.set(key, JSON.stringify(otpData), {
      KEEPTTL: true,
    });

    return false;
  }

  // Success → delete OTP
  await redisClient.del(key);
  return true;
};
