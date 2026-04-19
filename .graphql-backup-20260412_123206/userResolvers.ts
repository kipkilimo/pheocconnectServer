import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User";
import DiscussionGroup from "../../models/DiscussionGroup";
import Department from "../../models/Department";
import Resource from "../../models/Resource";

//   { path: "discussion_group", model: "" },
// { path: "department", model: "" },
import { sendEmail, EmailOptions } from "../../utils/emailHandler"; // Adjust import path as needed
import { generateUniqueCode } from "../../utils/identifier_generator";
import mongoose from "mongoose";

let redirectUrl;
// CLIENT_URL=${redirectUrl}

// CLIENT_DEV_URL=http://localhost:8000/
if (process.env.NODE_ENV === "production") {
  redirectUrl = process.env.CLIENT_URL;
} else {
  redirectUrl = process.env.CLIENT_DEV_URL;
}

interface ResourceSuggestion {
  title: any;
  coverImage: any;
  description: any;
  content: any;
  participants: any;
  targetRegion: any;
  language: any;
  sessionId: any;
  accessKey: any;
  subject: any;
  topic: any;
  keywords: any;
  createdBy: any;
  createdAt: any;
  contentType: any;
  id: any;
  resource: {
    id: string;
    title: string;
    coverImage?: string;
    description?: string;
    content?: string;
    participants?: string[];
    targetRegion?: string;
    language?: string;
    sessionId?: string;
    accessKey?: string;
    contentType?: string;
    subject?: string;
    topic?: string;
    keywords?: string[];
    createdBy: {
      id: string;
      personalInfo: { username: string };
      role: string;
    };
    createdAt: Date;
  };
  reason: string;
  score: number;
}
const userResolver = {
  Query: {
    verifyResetToken: async (_: any, { token }: { token: string }) => {
      console.log("[verifyResetToken] Checking token");

      const user = await User.findOne({
        $or: [
          { "personalInfo.activationToken": token },
          { "personalInfo.resetToken": token },
        ],
      });

      if (!user) {
        return { valid: false, email: null };
      }

      // Check if token has expired
      if (user.personalInfo.tokenExpiry) {
        const expiryTime = new Date(user.personalInfo.tokenExpiry);
        const currentTime = new Date();

        if (currentTime > expiryTime) {
          console.log("[verifyResetToken] Token expired");
          return { valid: false, email: null };
        }
      }

      return { valid: true, email: user.personalInfo.email };
    },
    async getUser(_: any, { scholarId }: { scholarId: string }) {
      return await User.findOne({ _id: scholarId });
    },
    async getUsers() {
      try {
        return await User.find()
          // Populate discussion groups
          .populate({
            path: "discussion_groups",
            model: "DiscussionGroup",
            select: "id discussionGroupId name members",
            populate: {
              path: "members",
              model: "User", // Assuming members are User references
              select: "id personalInfo.fullName personalInfo.email role",
            },
          })
          // Populate recent resources
          .populate({
            path: "recent_resources",
            model: "Resource",
            select:
              "id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
          })
          // Populate favorite resources
          .populate({
            path: "favorite_resources",
            model: "Resource",
            select:
              "id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
          })
          // Populate suggested resources
          .populate({
            path: "suggested_resources",
            model: "Resource",
            select:
              "id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
          })
          // Populate departments
          .populate({
            path: "departments",
            model: "Department",
            select: "id departmentId name members",
            populate: [
              {
                path: "faculty",
                model: "User", // Assuming faculty refers to User
                select: "id personalInfo.fullName personalInfo.email role",
              },
              {
                path: "students",
                model: "User", // Assuming students refer to User
                select: "id personalInfo.fullName personalInfo.email role",
              },
            ],
          })
          .exec();
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users");
      }
    },

    async getCurrentUser(_: any, { sessionId }: { sessionId: string }) {
      try {
        if (!sessionId) {
          return null;
        }
        // Fetch user with populated fields
        const user = await User.findOne({ _id: sessionId })
          .populate({
            path: "discussion_groups",
            model: "DiscussionGroup",
            select: {
              id: 1,
              discussionGroupId: 1,
              name: 1,
              // Populate members field to ensure correct data type
              members: 1,
            },
            populate: {
              path: "members", // Populating the members array to get the user ObjectIds
              model: "User", // Assuming members refer to User model
              select: {
                id: 1,
                personalInfo: {
                  fullName: 1,
                  email: 1,
                },
                role: 1,
              },
            },
          })
          .populate({
            path: "departments", // Corrected the typo from "departmentss" to "departments"
            model: "Department",
            select: {
              id: 1,
              departmentId: 1,
              name: 1,
              members: 1, // Populate members field
            },
            populate: [
              {
                path: "faculty", // Populating the faculty array
                model: "User", // Assuming faculty refers to User model
                select: {
                  id: 1,
                  "personalInfo.fullName": 1, // Select nested personalInfo fields
                  "personalInfo.email": 1,
                  role: 1,
                },
              },
              {
                path: "students", // Populating the students array
                model: "User", // Assuming students refer to User model
                select: {
                  id: 1,
                  "personalInfo.fullName": 1, // Select nested personalInfo fields
                  "personalInfo.email": 1,
                  role: 1,
                },
              },
            ],
          })
          .populate({
            path: "favorite_resources",
            model: "Resource",
            select: "id title",
          })
          .populate({
            path: "recent_resources",
            model: "Resource",
            select: "id title",
          })

          .populate({
            path: "suggested_resources",
            model: "Resource",
            select: "id title",
          })

          .exec();

        // console.log("getting user 3", user);
        // Check if user exists
        if (!user) {
          return {};
        }

        return user;
      } catch (error) {
        // Handle errors
        console.error("Error fetching current user:", error);
        throw new Error(
          "An error occurred while fetching the user. Please try again.",
        );
      }
    },
  },

  Mutation: {
    async createUser(
      _: any,
      {
        username,
        fullName,
        email,
        password,
      }: {
        username: string;
        fullName: string;
        email: string;
        password: string;
      },
    ) {
      const lastName = username.split(" ").pop();
      const formattedUsername = `${email.split("@")[0]}-${lastName}`;

      const hashedPassword = await bcrypt.hash(password, 12);
      const activationToken = generateUniqueCode(12);

      const user = new User({
        personalInfo: {
          scholarId: generateUniqueCode(12),
          fullName: fullName,
          username: formattedUsername.toLowerCase(),
          email,
          institution: "",
          department: "",
          profilePicture: "",
          password: hashedPassword,
          bio: "",
          dateOfBirth: null,
          gender: "",
          location: { city: "", state: "", country: "" },
          website: "",
          activationToken: activationToken,
          resetToken: "",
          tokenExpiry: String(Date.now() + 7200000),
          activatedAccount: false,
        },
        academicInfo: {
          researchInterests: [],
          publications: [],
          ongoingProjects: [],
          collaborations: [],
        },
        accountSettings: {
          privacySettings: { profileVisibility: "PUBLIC" },
          notificationSettings: { emailNotifications: true },
        },
        activityInfo: {
          lastLogin: null,
          accountCreationDate: new Date(),
        },
      });

      await user.save();

      // Theme colors from your design system
      const theme = {
        dark: false,
        colors: {
          primary: "#2A73C5",
          "primary-darken-1": "#2363A9",
          "primary-lighten-1": "#4A8ED4",
          secondary: "#5E60CE",
          accent: "#3D8BFF",
          success: "#2EBD85",
          warning: "#F4B740",
          error: "#E05658",
          info: "#3AB0FF",
          background: "#F5F7FA",
          surface: "#FFFFFF",
        },
      };
      const backgroundColor = theme.colors.background;
      const surfaceColor = theme.colors.surface;
      const primaryColor = theme.colors.primary;
      const secondaryColor = theme.colors.secondary;
      const successColor = theme.colors.success;
      const textColor = "#1A2C3E";
      const textMuted = "#6C757D";

      const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

    <tr>
      <td align="center" style="padding:20px 12px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px; background-color:${surfaceColor}; border-radius:12px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:22px 20px; border-bottom:1px solid #eef0f2;">
              <img
                src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
                alt="PHEOCConnect Logo"
                style="width:180px; max-width:70%; height:auto;"
              />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:22px 24px 10px 24px;">
              <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
                Welcome to PHEOCConnect Learning 🎉
              </h1>
              <p style="margin:8px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.5;">
                Hello ${user.personalInfo.fullName}, thanks for signing up! Activate your account to get started.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:10px 24px 0 24px; font-size:13px; color:${textColor}; line-height:1.6;">
              Click the button below to activate your account and access all features on PHEOCConnect Learning.
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:20px 24px;">
              <a href="${redirectUrl}auth/activate?token=${user.personalInfo.activationToken}"
                style="
                  display:inline-block;
                  padding:12px 22px;
                  font-size:14px;
                  font-weight:600;
                  color:#ffffff;
                  background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                  text-decoration:none;
                  border-radius:8px;
                ">
                Activate Your Account
              </a>
            </td>
          </tr>

          <!-- Fallback Link -->
          <tr>
            <td style="padding:0 24px 14px 24px; font-size:12px; color:${textMuted}; text-align:center;">
              If the button doesn’t work, copy and paste this link into your browser:
              <div style="margin-top:6px; word-break:break-all; color:${primaryColor};">
                ${redirectUrl}auth/activate?token=${user.personalInfo.activationToken}
              </div>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 24px 18px 24px;">
              <div style="
                background:${backgroundColor};
                border-left:4px solid ${primaryColor};
                padding:12px 14px;
                border-radius:6px;
                font-size:12px;
                color:${textMuted};
              ">
                Once activated, you can log in and start your learning journey.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none; border-top:1px solid #eef0f2;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px; font-size:12px; color:${textMuted}; line-height:1.6;">

              <div style="margin-bottom:6px;">
                The Hub for Learning Epidemiology, Biostatistics and Research Methods.
              </div>

              <div>Nairobi, KE</div>
              <div>Tel: +254 700 378 241 | Email: info@pheocconnect.com</div>

              <div style="margin-top:12px; font-size:11px; color:#a0a4aa;">
                © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
              </div>

            </td>
          </tr>

        </table>

      </td>
    </tr>

  </table>
</div>
`;

      const emailOptions = {
        to: [user.personalInfo.email],
        subject: "Activate Your Account on  PHEOCConnect Learning",
        html: emailBody,
      };

      // @ts-ignore
      await sendEmail(emailOptions);

      return user;
    },

    async updateUser(
      _: any,
      { scholarId, input }: { scholarId: string; input: any },
    ) {
      return await User.findOneAndUpdate(
        { scholarId: scholarId },
        { $set: input },
        { new: true },
      );
    },
    async singleSigninLogin(_: any, { accessKey }: { accessKey: string }) {
      const user = await User.findOne({
        "personalInfo.activationToken": accessKey,
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.personalInfo.activatedAccount === false) {
        const activationToken = generateUniqueCode(12);

        // Theme colors from your design system
        const theme = {
          dark: false,
          colors: {
            primary: "#2A73C5",
            "primary-darken-1": "#2363A9",
            "primary-lighten-1": "#4A8ED4",
            secondary: "#5E60CE",
            accent: "#3D8BFF",
            success: "#2EBD85",
            warning: "#F4B740",
            error: "#E05658",
            info: "#3AB0FF",
            background: "#F5F7FA",
            surface: "#FFFFFF",
          },
        };
        const backgroundColor = theme.colors.background;
        const surfaceColor = theme.colors.surface;
        const primaryColor = theme.colors.primary;
        const secondaryColor = theme.colors.secondary;
        const successColor = theme.colors.success;
        const textColor = "#1A2C3E";
        const textMuted = "#6C757D";

        const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

    <tr>
      <td align="center" style="padding:20px 12px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px; background-color:${surfaceColor}; border-radius:12px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:22px 20px; border-bottom:1px solid #eef0f2;">
              <img
                src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
                alt="PHEOCConnect Logo"
                style="width:180px; max-width:70%; height:auto;"
              />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:22px 24px 10px 24px;">
              <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
                Welcome to PHEOCConnect Learning 🎉
              </h1>
              <p style="margin:8px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.5;">
                Hello ${user.personalInfo.fullName}, your account is almost ready.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:10px 24px 0 24px; font-size:13px; color:${textColor}; line-height:1.6;">
              Activate your account to unlock all features and start your learning journey.
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:20px 24px;">
              <a href="${redirectUrl}auth/activate?token=${activationToken}"
                style="
                  display:inline-block;
                  padding:12px 22px;
                  font-size:14px;
                  font-weight:600;
                  color:#ffffff;
                  background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                  text-decoration:none;
                  border-radius:8px;
                ">
                Activate Your Account
              </a>
            </td>
          </tr>

          <!-- Fallback -->
          <tr>
            <td style="padding:0 24px 14px 24px; font-size:12px; color:${textMuted}; text-align:center;">
              If the button doesn’t work, copy and paste this link into your browser:
              <div style="margin-top:6px; word-break:break-all; color:${primaryColor};">
                ${redirectUrl}auth/activate?token=${activationToken}
              </div>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:0 24px 18px 24px;">
              <div style="
                background:${backgroundColor};
                border-left:4px solid ${primaryColor};
                padding:12px 14px;
                border-radius:6px;
                font-size:12px;
                color:${textMuted};
              ">
                Once activated, you can log in and begin using PHEOCConnect Learning.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none; border-top:1px solid #eef0f2;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px; font-size:12px; color:${textMuted}; line-height:1.6;">
              <div style="margin-bottom:6px;">
                The Hub for Learning Epidemiology, Biostatistics and Research Methods.
              </div>
              <div>Nairobi, KE</div>
              <div>Tel: +254 700 378 241 | Email: info@pheocconnect.com</div>
              <div style="margin-top:12px; font-size:11px; color:#a0a4aa;">
                © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>

  </table>
</div>
`;

        const emailOptions = {
          to: [user.personalInfo.email],
          subject: "Activate Your Account on  PHEOCConnect Learning",
          html: emailBody,
        };

        // @ts-ignore
        await sendEmail(emailOptions);
        user.personalInfo.activationToken = activationToken;
        user.personalInfo.resetToken = activationToken;
        user.personalInfo.tokenExpiry = String(Date.now() + 7200000);
        user.personalInfo.activatedAccount = false;
        await user.save();

        throw new Error(
          "Activate your account first. An activation link was sent to your email.",
        );
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });
      user.personalInfo.activationToken = "";
      user.personalInfo.resetToken = "";
      user.personalInfo.tokenExpiry = "";
      user.personalInfo.activatedAccount = true;
      await user.save();
      return { user, accessToken: token };
    },
    async login(
      _: any,
      { email, password }: { email: string; password: string },
    ) {
      const user = await User.findOne({ "personalInfo.email": email });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.personalInfo.activatedAccount === false) {
        const activationToken = generateUniqueCode(12);

        // Theme colors from your design system
        const theme = {
          dark: false,
          colors: {
            primary: "#2A73C5",
            "primary-darken-1": "#2363A9",
            "primary-lighten-1": "#4A8ED4",
            secondary: "#5E60CE",
            accent: "#3D8BFF",
            success: "#2EBD85",
            warning: "#F4B740",
            error: "#E05658",
            info: "#3AB0FF",
            background: "#F5F7FA",
            surface: "#FFFFFF",
          },
        };
        const backgroundColor = theme.colors.background;
        const surfaceColor = theme.colors.surface;
        const primaryColor = theme.colors.primary;
        const secondaryColor = theme.colors.secondary;
        const successColor = theme.colors.success;
        const textColor = "#1A2C3E";
        const textMuted = "#6C757D";

        const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:${textColor};">

  <!-- Top Logo Stripe -->
  <div style="background-color:${surfaceColor}; padding:20px; text-align:center; border-bottom:1px solid #eef0f2;">
    <img 
      src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png" 
      alt="PHEOCConnect Learning Logo" 
      style="width:180px; max-width:70%; height:auto;"
    />
  </div>

  <!-- Email Content -->
  <div style="max-width:600px; margin:0 auto; background:${surfaceColor}; padding:24px; border-radius:12px; margin-top:20px;">

    <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
      Welcome to PHEOCConnect Learning 🎉
    </h1>

    <p style="margin:10px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.6;">
      Hello ${user.personalInfo.fullName}, thank you for signing up.
    </p>

    <p style="margin:14px 0 0 0; font-size:13px; line-height:1.6;">
      To activate your account and access all features, please click the button below:
    </p>

    <!-- CTA Button -->
    <div style="text-align:center; margin:22px 0;">
      <a href="${redirectUrl}auth/activate?token=${activationToken}"
        style="
          display:inline-block;
          padding:12px 22px;
          font-size:14px;
          font-weight:600;
          color:#ffffff;
          background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
          text-decoration:none;
          border-radius:8px;
        ">
        Activate Your Account
      </a>
    </div>

    <!-- Fallback -->
    <p style="font-size:12px; color:${textMuted}; text-align:center; margin:0;">
      If the button doesn’t work, copy and paste this link:
    </p>
    <p style="font-size:12px; color:${primaryColor}; word-break:break-all; text-align:center; margin-top:6px;">
      ${redirectUrl}auth/activate?token=${activationToken}
    </p>

    <!-- Note -->
    <div style="
      margin-top:18px;
      background:${backgroundColor};
      border-left:4px solid ${primaryColor};
      padding:12px 14px;
      border-radius:6px;
      font-size:12px;
      color:${textMuted};
    ">
      Once activated, you can log in and start using PHEOCConnect Learning.
    </div>

  </div>

  <!-- Footer -->
  <div style="background-color:${backgroundColor}; padding:20px; text-align:center; font-size:12px; color:${textMuted}; margin-top:20px;">

    <p style="margin:0 0 6px 0;">
      The Hub for Learning Epidemiology, Biostatistics and Research Methods.
    </p>

    <p style="margin:0;">Nairobi, KE</p>
    <p style="margin:4px 0 0 0;">Tel: +254 700 378 241 | Email: info@pheocconnect.com</p>

    <p style="margin-top:12px; font-size:11px; color:#a0a4aa;">
      © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
    </p>

  </div>

</div>
`;

        const emailOptions = {
          to: [user.personalInfo.email],
          subject: "Activate Your Account on  PHEOCConnect Learning",
          html: emailBody,
        };

        // @ts-ignore
        await sendEmail(emailOptions);
        user.personalInfo.activationToken = activationToken;
        user.personalInfo.resetToken = activationToken;
        user.personalInfo.tokenExpiry = String(Date.now() + 7200000);
        user.personalInfo.activatedAccount = false;
        await user.save();

        throw new Error(
          "Activate your account first. An activation link was sent to your email.",
        );
      }

      const isMatch = await bcrypt.compare(
        password,
        user.personalInfo.password,
      );
      if (!isMatch) {
        throw new Error("Incorrect password");
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });
      return { user, accessToken: token };
    },

    async activate(_: any, { activationToken }: { activationToken: string }) {
      const user = await User.findOne({
        "personalInfo.activationToken": activationToken,
      });
      if (!user) {
        throw new Error("Invalid activation token");
      }

      if (user.personalInfo.activatedAccount === false) {
        const newActivationToken = generateUniqueCode(12);

        // Theme colors from your design system
        const theme = {
          dark: false,
          colors: {
            primary: "#2A73C5",
            "primary-darken-1": "#2363A9",
            "primary-lighten-1": "#4A8ED4",
            secondary: "#5E60CE",
            accent: "#3D8BFF",
            success: "#2EBD85",
            warning: "#F4B740",
            error: "#E05658",
            info: "#3AB0FF",
            background: "#F5F7FA",
            surface: "#FFFFFF",
          },
        };
        const backgroundColor = theme.colors.background;
        const surfaceColor = theme.colors.surface;
        const primaryColor = theme.colors.primary;
        const secondaryColor = theme.colors.secondary;
        const successColor = theme.colors.success;
        const textColor = "#1A2C3E";
        const textMuted = "#6C757D";

        const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:${textColor};">

  <!-- Top Logo Stripe -->
  <div style="background-color:${surfaceColor}; padding:20px; text-align:center; border-bottom:1px solid #eef0f2;">
    <img 
      src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png" 
      alt="PHEOCConnect Learning Logo" 
      style="width:180px; max-width:70%; height:auto;"
    />
  </div>

  <!-- Email Content -->
  <div style="max-width:600px; margin:0 auto; background:${surfaceColor}; padding:24px; border-radius:12px; margin-top:20px;">

    <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
      Activate Your Profile
    </h1>

    <p style="margin:10px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.6;">
      Hello ${user.personalInfo.fullName}, your account is almost ready.
    </p>

    <p style="margin:14px 0 0 0; font-size:13px; line-height:1.6;">
      To activate your account and start using PHEOCConnect Learning, click the button below:
    </p>

    <!-- CTA Button -->
    <div style="text-align:center; margin:22px 0;">
      <a href="${redirectUrl}auth/activate?token=${newActivationToken}"
        style="
          display:inline-block;
          padding:12px 22px;
          font-size:14px;
          font-weight:600;
          color:#ffffff;
          background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
          text-decoration:none;
          border-radius:8px;
        ">
        Activate Profile
      </a>
    </div>

    <!-- Fallback -->
    <p style="font-size:12px; color:${textMuted}; text-align:center; margin:0;">
      If the button doesn’t work, copy and paste this link:
    </p>
    <p style="font-size:12px; color:${primaryColor}; word-break:break-all; text-align:center; margin-top:6px;">
      ${redirectUrl}auth/activate?token=${newActivationToken}
    </p>

    <!-- Note -->
    <div style="
      margin-top:18px;
      background:${backgroundColor};
      border-left:4px solid ${primaryColor};
      padding:12px 14px;
      border-radius:6px;
      font-size:12px;
      color:${textMuted};
    ">
      Once activated, you can log in and begin your learning experience.
    </div>

  </div>

  <!-- Footer -->
  <div style="background-color:${backgroundColor}; padding:20px; text-align:center; font-size:12px; color:${textMuted}; margin-top:20px;">

    <p style="margin:0 0 6px 0;">
      The Hub for Learning Epidemiology, Biostatistics and Research Methods.
    </p>

    <p style="margin:0;">Nairobi, KE</p>
    <p style="margin:4px 0 0 0;">Tel: +254 700 378 241 | Email: info@pheocconnect.com</p>

    <p style="margin-top:12px; font-size:11px; color:#a0a4aa;">
      © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
    </p>

  </div>

</div>
`;

        const emailOptions = {
          to: [user.personalInfo.email],
          subject: "Activate Your Account on  PHEOCConnect Learning",
          html: emailBody,
        };

        // @ts-ignore
        await sendEmail(emailOptions);
        user.personalInfo.activationToken = newActivationToken;
        user.personalInfo.resetToken = newActivationToken;
        user.personalInfo.tokenExpiry = String(Date.now() + 7200000);
        user.personalInfo.activatedAccount = false;
        await user.save();
        return { user, accessToken: null };
      }

      user.personalInfo.activationToken = "";
      user.personalInfo.resetToken = "";
      user.personalInfo.tokenExpiry = "";
      user.personalInfo.activatedAccount = true;
      await user.save();

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });
      return { user, accessToken: token };
    },

    async resetPassword(
      _: any,
      {
        activationToken,
        password,
      }: { activationToken: string; password: string },
    ) {
      console.log("[resetPassword] Received token:", activationToken);
      console.log("[resetPassword] Token length:", activationToken?.length);

      if (!activationToken) {
        console.error("[resetPassword] No token provided");
        throw new Error("Activation token is required");
      }

      if (!password || password.length < 6 || password.length > 12) {
        console.error("[resetPassword] Invalid password length");
        throw new Error("Password must be 6-12 characters long");
      }

      // Find user by EITHER activationToken OR resetToken
      const user = await User.findOne({
        $or: [
          { "personalInfo.activationToken": activationToken },
          { "personalInfo.resetToken": activationToken },
        ],
      });

      console.log("[resetPassword] User found:", !!user);

      if (!user) {
        console.error("[resetPassword] No user found with token");
        throw new Error("Invalid or expired activation token");
      }

      console.log("[resetPassword] User email:", user.personalInfo.email);
      console.log(
        "[resetPassword] Stored activationToken:",
        user.personalInfo.activationToken,
      );
      console.log(
        "[resetPassword] Stored resetToken:",
        user.personalInfo.resetToken,
      );
      console.log(
        "[resetPassword] Token expiry:",
        user.personalInfo.tokenExpiry,
      );
      console.log("[resetPassword] Current time:", new Date());

      // Check if token has expired
      if (user.personalInfo.tokenExpiry) {
        const expiryTime = new Date(user.personalInfo.tokenExpiry);
        const currentTime = new Date();

        if (currentTime > expiryTime) {
          console.error("[resetPassword] Token expired at:", expiryTime);
          throw new Error(
            "Password reset link has expired. Please request a new one.",
          );
        }
      }

      // Check if account is already activated
      if (user.personalInfo.activatedAccount === true) {
        console.error("[resetPassword] Account already activated");
        throw new Error("This reset link has already been used. Please login.");
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("[resetPassword] Password hashed successfully");

      // Update user
      user.personalInfo.password = hashedPassword;
      user.personalInfo.activationToken = "";
      user.personalInfo.resetToken = "";
      user.personalInfo.tokenExpiry = "";
      user.personalInfo.activatedAccount = true;

      await user.save();
      console.log("[resetPassword] User updated successfully");

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.personalInfo.email },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );

      console.log("[resetPassword] JWT generated successfully");

      return { user, accessToken: token };
    },
    async singleSignInRequest(_: any, { email }: { email: string }) {
      const user = await User.findOne({
        "personalInfo.email": email,
      });

      if (!user) {
        throw new Error("User not found.");
      }
      const activationToken = generateUniqueCode(12);
      // Theme colors from your design system
      const theme = {
        dark: false,
        colors: {
          primary: "#2A73C5",
          "primary-darken-1": "#2363A9",
          "primary-lighten-1": "#4A8ED4",
          secondary: "#5E60CE",
          accent: "#3D8BFF",
          success: "#2EBD85",
          warning: "#F4B740",
          error: "#E05658",
          info: "#3AB0FF",
          background: "#F5F7FA",
          surface: "#FFFFFF",
        },
      };

      const backgroundColor = theme.colors.background;
      const surfaceColor = theme.colors.surface;
      const primaryColor = theme.colors.primary;
      const secondaryColor = theme.colors.secondary;
      const successColor = theme.colors.success;
      const textColor = "#1A2C3E";
      const textMuted = "#6C757D";

      const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

    <tr>
      <td align="center" style="padding:20px 12px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px; background-color:${surfaceColor}; border-radius:12px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:22px 20px; background:${surfaceColor}; border-bottom:1px solid #eef0f2;">
              <img
                src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
                alt="PHEOCConnect Logo"
                style="width:180px; max-width:70%; height:auto;"
              />
            </td>
          </tr>

          <!-- Title Section -->
          <tr>
            <td style="padding:22px 24px 10px 24px;">
              <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
                One-Time Login Password
              </h1>
              <p style="margin:8px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.5;">
                Hello ${user.personalInfo.fullName}, use the code below to sign in to your PHEOCConnect account.
              </p>
            </td>
          </tr>

          <!-- OTP Block -->
          <tr>
            <td align="center" style="padding:18px 24px;">

              <div style="
                display:inline-block;
                padding:14px 18px;
                font-size:22px;
                font-weight:700;
                letter-spacing:6px;
                color:${primaryColor};
                background:${backgroundColor};
                border:1px solid #e6e9ef;
                border-radius:10px;
                font-family:monospace;
              ">
                ${activationToken}
              </div>

              <p style="margin:14px 0 0 0; font-size:12px; color:${textMuted};">
                This code will expire shortly. Do not share it with anyone.
              </p>

            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 24px 18px 24px;">
              <div style="
                background:#fff8e6;
                border-left:4px solid #f5b301;
                padding:12px 14px;
                border-radius:6px;
                font-size:12px;
                color:#6b5b00;
              ">
                <strong>Security Tip:</strong> If you did not request this login code, you should secure your account immediately.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none; border-top:1px solid #eef0f2;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px; font-size:12px; color:${textMuted}; line-height:1.6;">

              <div style="margin-bottom:6px;">
                The Hub for Learning Epidemiology, Biostatistics and Research Methods.
              </div>

              <div>Nairobi, KE</div>
              <div>Tel: +254 700 378 241 | Email: info@pheocconnect.com</div>

              <div style="margin-top:12px; font-size:11px; color:#a0a4aa;">
                © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
              </div>

            </td>
          </tr>

        </table>
        <!-- End Container -->

      </td>
    </tr>

  </table>
</div>
`;
      const emailOptions = {
        to: [user.personalInfo.email],
        subject: "One time signin pin on PHEOCConnect Learning",
        html: emailBody,
      };

      // @ts-ignore
      await sendEmail(emailOptions);
      user.personalInfo.activationToken = activationToken;
      user.personalInfo.resetToken = activationToken;
      user.personalInfo.tokenExpiry = String(Date.now() + 7200000); // 2 hours
      await user.save();
      return user;
    },

    // REQUEST RESET TOKEN
    async requestPasswordReset(_: any, { email }: { email: string }) {
      // Generate a proper crypto token instead of a simple code
      const crypto = require("crypto");
      const activationToken = crypto.randomBytes(32).toString("hex");

      console.log("[requestPasswordReset] Generated token:", activationToken);
      console.log(
        "[requestPasswordReset] Token length:",
        activationToken.length,
      );

      const user = await User.findOne({
        "personalInfo.email": email,
      });

      if (!user) {
        console.log("[requestPasswordReset] User not found for email:", email);
        throw new Error("User not found.");
      }

      console.log(
        "[requestPasswordReset] User found:",
        user.personalInfo.email,
      );

      // Calculate expiry time (2 hours from now)
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 2);

      console.log("[requestPasswordReset] Token expiry:", tokenExpiry);

      // Theme colors from your design system
      const theme = {
        dark: false,
        colors: {
          primary: "#2A73C5",
          "primary-darken-1": "#2363A9",
          "primary-lighten-1": "#4A8ED4",
          secondary: "#5E60CE",
          accent: "#3D8BFF",
          success: "#2EBD85",
          warning: "#F4B740",
          error: "#E05658",
          info: "#3AB0FF",
          background: "#F5F7FA",
          surface: "#FFFFFF",
        },
      };

      const backgroundColor = theme.colors.background;
      const surfaceColor = theme.colors.surface;
      const primaryColor = theme.colors.primary;
      const secondaryColor = theme.colors.secondary;
      const textColor = "#1A2C3E";
      const textMuted = "#6C757D";

      const emailBody = `
<div style="margin:0; padding:0; background-color:${backgroundColor};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="background-color:${backgroundColor}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">

    <tr>
      <td align="center" style="padding:20px 12px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px; background-color:${surfaceColor}; border-radius:12px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:22px 20px; border-bottom:1px solid #eef0f2;">
              <img
                src="https://a2z-v0.s3.eu-central-1.amazonaws.com/Screenshot+from+2024-10-22+16-31-16.png"
                alt="PHEOCConnect Logo"
                style="width:180px; max-width:70%; height:auto;"
              />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:22px 24px 10px 24px;">
              <h1 style="margin:0; font-size:20px; font-weight:700; color:${textColor}; letter-spacing:-0.2px;">
                Password Reset Request
              </h1>
              <p style="margin:8px 0 0 0; font-size:13px; color:${textMuted}; line-height:1.5;">
                Hello ${user.personalInfo.fullName}, we received a request to reset your password.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:10px 24px 0 24px; font-size:13px; color:${textColor}; line-height:1.6;">
              To continue, click the button below to securely reset your password.
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:20px 24px;">
              <a href="${redirectUrl}/auth/reset?token=${activationToken}"
                style="
                  display:inline-block;
                  padding:12px 22px;
                  font-size:14px;
                  font-weight:600;
                  color:#ffffff;
                  background:linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                  text-decoration:none;
                  border-radius:8px;
                ">
                Reset Password
              </a>
            </td>
          </tr>

          <!-- Fallback Link -->
          <tr>
            <td style="padding:0 24px 14px 24px; font-size:12px; color:${textMuted}; text-align:center;">
              If the button doesn't work, copy and paste this link into your browser:
              <div style="margin-top:6px; word-break:break-all; color:${primaryColor};">
                ${redirectUrl}/auth/reset?token=${activationToken}
              </div>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 24px 18px 24px;">
              <div style="
                background:#fff5f5;
                border-left:4px solid ${theme.colors.error};
                padding:12px 14px;
                border-radius:6px;
                font-size:12px;
                color:${textMuted};
              ">
                <strong>Didn't request this?</strong> You can safely ignore this email. Your password will remain unchanged.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none; border-top:1px solid #eef0f2;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px; font-size:12px; color:${textMuted}; line-height:1.6;">
              <div style="margin-bottom:6px;">
                The Hub for Learning Epidemiology, Biostatistics and Research Methods.
              </div>
              <div>Nairobi, KE</div>
              <div>Tel: +254 700 378 241 | Email: info@pheocconnect.com</div>
              <div style="margin-top:12px; font-size:11px; color:#a0a4aa;">
                © ${new Date().getFullYear()} PHEOCConnect Learning. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</div>
`;

      const emailOptions = {
        to: [user.personalInfo.email],
        subject: "Password Reset Request on PHEOCConnect Learning",
        html: emailBody,
      };

      // @ts-ignore
      await sendEmail(emailOptions);

      // Store the token properly
      user.personalInfo.activationToken = activationToken;
      user.personalInfo.resetToken = activationToken;
      user.personalInfo.tokenExpiry = String(tokenExpiry); // Store as Date object, not string
      user.personalInfo.activatedAccount = false; // Ensure account is not activated

      await user.save();

      console.log(
        "[requestPasswordReset] Token saved successfully for:",
        user.personalInfo.email,
      );
      console.log(
        "[requestPasswordReset] Stored token:",
        user.personalInfo.activationToken,
      );

      return user;
    },

    async deleteUserByScholarId(_: any, { scholarId }: { scholarId: string }) {
      const user = await User.findOneAndDelete({
        _id: scholarId,
      });
      if (!user) throw new Error("User not found");
      return user;
    },

    async addResourceToRecents(
      _: any,
      args: { userId: string; resourceId: string },
    ) {
      try {
        // Destructure arguments for clarity
        const { userId, resourceId } = args;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
          throw new Error("User not found");
        }

        const resourceObjectId = new mongoose.Types.ObjectId(resourceId);

        // Prevent duplicate entries in recents
        if (user.recent_resources.some((id) => id.equals(resourceObjectId))) {
          return user; // No action needed
        }

        // Add resource to user's recent resources at the beginning of the array
        user.recent_resources.unshift(resourceObjectId);

        // Optionally enforce a maximum size for the `recent_resources` array
        const MAX_RECENTS = 10;
        if (user.recent_resources.length > MAX_RECENTS) {
          user.recent_resources = user.recent_resources.slice(0, MAX_RECENTS);
        }

        // Save the user
        await user.save();

        return user;
      } catch (error) {
        console.error("Error adding to recents:", error);
        throw new Error("Failed to add resource to recents");
      }
    },

    async addResourceToFavorites(
      _: any,
      args: { userId: string; resourceId: string },
    ) {
      try {
        // Find the user and the resource
        const user = await User.findById(args.userId);
        if (!user) {
          throw new Error("User not found");
        }

        const resourceId = new mongoose.Types.ObjectId(args.resourceId);
        if (user.favorite_resources.some((id) => id.equals(resourceId))) {
          return user; // No action needed
        }

        // Add resource to user's favorites
        user.favorite_resources.push(resourceId);

        // Increment the resource's like count
        const resource = await Resource.findById(args.resourceId);
        if (!resource) {
          throw new Error("Resource not found");
        }

        resource.likesNumber = (resource.likesNumber || 0) + 1;

        // Save both entities
        await Promise.all([user.save(), resource.save()]);
        return user;
      } catch (error) {
        console.error("Error adding to favorites:", error);
        throw new Error("Failed to add resource to favorites");
      }
    },

    rateReviewResources: async (
      _: any,
      args: {
        userId: string;
        resourceId: string;
        reviewDetails: { rating: number; text: string };
      },
    ) => {
      try {
        const { userId, resourceId, reviewDetails } = args;

        // Fetch the resource by ID
        const resource = await Resource.findById(resourceId);
        if (!resource) {
          throw new Error("Resource not found");
        }

        // Add the new review
        const newReview = {
          reviewingUser: userId,
          reviewRating: reviewDetails.rating,
          reviewText: reviewDetails.text,
        };

        // Append to existing reviews array
        const updatedReviews = [
          ...JSON.parse(resource.reviews || "[]"),
          newReview,
        ];
        function getAverageRating(reviewsJson: string) {
          try {
            // Parse the JSON string into an array
            const reviews = JSON.parse(reviewsJson);

            // Check if reviews is an array
            if (!Array.isArray(reviews) || reviews.length === 0) {
              return 0; // Return 0 if no reviews
            }

            // Sum all review ratings
            const totalRating = reviews.reduce((sum, review) => {
              return sum + (review.reviewRating || 0);
            }, 0);

            // Calculate average
            const averageRating = totalRating / reviews.length;

            return averageRating;
          } catch (error) {
            console.error("Error parsing reviews JSON:", error);
            return 0; // Return 0 on error
          }
        }

        // Example usage
        const reviewsJson = resource.reviews || "";
        const averageRating = getAverageRating(reviewsJson);
        resource.averageRating = averageRating;
        // Update and save the resource
        resource.reviews = JSON.stringify(updatedReviews);
        await resource.save();
        return resource;
      } catch (error) {
        console.error("Error adding review:", error);
        throw new Error("Unable to add review");
      }
    },
    rebaseUserDocuments: async (): Promise<RebaseResult> => {
      try {
        // Get all users from the database
        const users = await User.find({});
        let processedCount = 0;
        const errors: string[] = [];

        for (const oldUser of users) {
          try {
            // Convert to plain object to make manipulation easier
            const oldUserObj = oldUser.toObject();

            // Create new user structure based on the schema
            const newUser: any = {
              personalInfo: {
                scholarId: oldUserObj.personalInfo?.scholarId || "",
                fullName: oldUserObj.personalInfo?.fullName || "",
                email: oldUserObj.personalInfo?.email || "",
                password: oldUserObj.personalInfo?.password || "",
                institution: oldUserObj.personalInfo?.institution || "",
                department: oldUserObj.personalInfo?.department || "",
                profilePicture: oldUserObj.personalInfo?.profilePicture || "",
                publication_credits:
                  oldUserObj.personalInfo?.publication_credits || "0",
                bio: oldUserObj.personalInfo?.bio || "",
                dateOfBirth: oldUserObj.personalInfo?.dateOfBirth || "",
                gender: oldUserObj.personalInfo?.gender || "",
                location: {
                  city: oldUserObj.personalInfo?.location?.city || "",
                  state: oldUserObj.personalInfo?.location?.state || "",
                  country: oldUserObj.personalInfo?.location?.country || "",
                },
                username: oldUserObj.personalInfo?.username || "",
                website: oldUserObj.personalInfo?.website || "",
                activationToken: oldUserObj.personalInfo?.activationToken || "",
                resetToken: oldUserObj.personalInfo?.resetToken || "",
                tokenExpiry: oldUserObj.personalInfo?.tokenExpiry || "",
                activatedAccount:
                  oldUserObj.personalInfo?.activatedAccount || false,
              },
              academicInfo: {
                researchInterests:
                  oldUserObj.academicInfo?.researchInterests || [],
                publications: oldUserObj.academicInfo?.publications || [],
                ongoingProjects: oldUserObj.academicInfo?.ongoingProjects || [],
                collaborations: oldUserObj.academicInfo?.collaborations || [],
              },
              accountSettings: {
                privacySettings: {
                  profileVisibility:
                    oldUserObj.accountSettings?.privacySettings
                      ?.profileVisibility || "public",
                },
                notificationSettings: {
                  emailNotifications:
                    oldUserObj.accountSettings?.notificationSettings
                      ?.emailNotifications || true,
                },
              },
              activityInfo: {
                lastLogin: oldUserObj.activityInfo?.lastLogin || null,
                accountCreationDate:
                  oldUserObj.activityInfo?.accountCreationDate || new Date(),
              },
              role: oldUserObj.role || "STUDENT",
              discussion_groups: oldUserObj.discussion_groups || [],
              departments: oldUserObj.departments || [],
              favorite_resources: oldUserObj.favorite_resources || [],
              recent_resources: oldUserObj.recent_resources || [],
              suggested_resources: oldUserObj.suggested_resources || [],
              done_exams: oldUserObj.done_exams || [],
              subscriptionDetails: {
                // Remove subscriptionStatus and only keep the new structure
                status: oldUserObj.subscriptionDetails?.status || "FREE",
                expiry: oldUserObj.subscriptionDetails?.expiry || null,
              },
              dailyResourceLimit: oldUserObj.dailyResourceLimit || 10,
              resourcesUsedToday: oldUserObj.resourcesUsedToday || 0,
              dailyLimitReset:
                oldUserObj.dailyLimitReset ||
                new Date(new Date().setDate(new Date().getDate() + 1)),
            };

            // First remove the old subscriptionStatus field if it exists at root level

            // Then update with the new structure
            await User.updateOne(
              { _id: oldUser._id },
              { $set: newUser },
              { strict: true },
            );

            processedCount++;
          } catch (error) {
            errors.push(`Error processing user ${oldUser._id}: ${error}`);
          }
        }

        return {
          success: errors.length === 0,
          message:
            errors.length > 0
              ? `Completed with ${errors.length} errors`
              : "Successfully rebased all user documents",
          usersProcessed: processedCount,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to rebase user documents: ${error}`,
          usersProcessed: 0,
          // @ts-ignore
          errors: [error],
        };
      }
    },
  },
};
// Add this type definition
interface RebaseResult {
  success: boolean;
  message: string;
  usersProcessed: number;
  errors?: string[];
}
export default userResolver;
