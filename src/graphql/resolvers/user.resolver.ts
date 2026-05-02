import { IResolvers } from "@graphql-tools/utils";
import User from "../../database/models/User";
import mongoose from "mongoose";
import {
  sendEmail,
  createOTPEmail,
  createWelcomeEmail,
  createAccountDeactivationEmail,
  createAccountReactivationEmail,
  createRoleChangeEmail,
} from "../../utils/emailTemplates";
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
} from "../../utils/authGenerator";
import { otpService } from "../../services/otp.service";
import { GraphQLError } from "graphql";

/* ============================================
 HELPERS
============================================ */

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

const toId = (doc: any) => {
  if (!doc) return doc;
  return {
    ...doc,
    id: doc._id?.toString?.() ?? doc.id,
  };
};

const getAppContext = (context: any) => {
  const app = process.env.APP_NAME || "pheocconnect";
  const domain =
    context?.req?.headers?.origin ||
    context?.req?.headers?.host ||
    "pheocconnect.org";
  return { app, domain };
};

/* ============================================
 RESOLVER
============================================ */

export const userResolver: IResolvers = {
  Query: {
    async publicDashboard() {
      return {
        stats: {
          totalUsers: await User.countDocuments(),
          activeSessions: 0,
          systemHealth: "OPERATIONAL",
          lastUpdated: new Date(),
        },
        recentActivities: [],
        announcements: [],
      };
    },

    async publicAnnouncements() {
      return [];
    },

    async users(_, __, context) {
      // Admin only - add role check
      if (!context.user || context.user.role !== "ADMIN") {
        throw new GraphQLError("Not authorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }
      const users = await User.find().lean();
      return users.map(toId);
    },

    async user(_, { id }, context) {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (!isValidObjectId(id)) {
        throw new GraphQLError("Invalid user ID", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = await User.findById(id).lean();
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return toId(user);
    },

    async myProfile(_, __, context) {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const user = await User.findById(context.user.id).lean();
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return toId(user);
    },
  },

  Mutation: {
    /* ============================================
     AUTHENTICATION
    ============================================ */

    async requestOTP(_, { input }, context) {
      const { email } = input;
      const { app, domain } = getAppContext(context);

      const user = await User.findOne({ email });
      if (!user) {
        throw new GraphQLError("No account found with this email", {
          extensions: { code: "USER_NOT_FOUND" },
        });
      }
      if (!user.active) {
        throw new GraphQLError("Account is deactivated", {
          extensions: { code: "ACCOUNT_DEACTIVATED" },
        });
      }

      const rateLimit = await otpService.checkOTPRateLimit(
        app,
        domain,
        email,
        "login",
        60,
      );
      if (!rateLimit.allowed) {
        throw new GraphQLError(
          `Wait ${rateLimit.remainingSeconds}s before retry`,
          {
            extensions: { code: "RATE_LIMITED" },
          },
        );
      }

      const otpCode = otpService.generateOTP();
      await otpService.storeOTP(app, domain, email, otpCode);

      const html = createOTPEmail(otpCode, 15);
      await sendEmail(email, "Login OTP", html);

      return {
        success: true,
        message: "OTP sent",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        remainingAttempts: 3,
        lockedUntil: null,
      };
    },

    async verifyOTP(_, { input }, context) {
      const { email, otpCode } = input;
      const { app, domain } = getAppContext(context);

      try {
        const isValid = await otpService.verifySimpleOTP(
          app,
          domain,
          email,
          otpCode,
        );

        if (!isValid) {
          throw new GraphQLError("Invalid OTP", {
            extensions: { code: "INVALID_OTP" },
          });
        }

        const user = await User.findOne({ email });
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }

        if (!user.active) {
          throw new GraphQLError("Account disabled", {
            extensions: { code: "ACCOUNT_DISABLED" },
          });
        }

        // Use the generateTokens utility for consistent expiry (7 days for both)
        const { accessToken, refreshToken } = generateTokens({
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        });

        user.lastLoginAt = new Date();
        await user.save();

        return {
          accessToken,
          refreshToken,
          requiresMFA: false,
          user: toId(user.toObject()),
        };
      } catch (err: any) {
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(err.message || "OTP verification failed", {
          extensions: { code: "OTP_FAILED" },
        });
      }
    },

    async refreshToken(_, { input }) {
      try {
        if (!input.refreshToken) {
          throw new GraphQLError("Refresh token required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Use the refreshAccessToken utility
        const newAccessToken = refreshAccessToken(input.refreshToken);

        if (!newAccessToken) {
          throw new GraphQLError("Invalid or expired refresh token", {
            extensions: { code: "INVALID_TOKEN" },
          });
        }

        // Get user info from the new access token
        const decoded = verifyAccessToken(newAccessToken);
        if (!decoded || !decoded.id) {
          throw new GraphQLError("Invalid token data", {
            extensions: { code: "INVALID_TOKEN" },
          });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }

        if (!user.active) {
          throw new GraphQLError("Account is deactivated", {
            extensions: { code: "ACCOUNT_DEACTIVATED" },
          });
        }

        return {
          accessToken: newAccessToken,
          refreshToken: input.refreshToken,
          user: toId(user.toObject()),
          requiresMFA: false,
        };
      } catch (err: any) {
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(err.message || "Failed to refresh token", {
          extensions: { code: "REFRESH_FAILED" },
        });
      }
    },

    async logout(_, __, context) {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      // In a real implementation, you'd blacklist the token or invalidate the session
      return true;
    },

    /* ============================================
     CREATE USER
    ============================================ */

    async createUser(_, { input }, context) {
      const { app, domain } = getAppContext(context);
      const { email, name, role, phone, organizationId } = input;

      // Check if user already exists
      const exists = await User.findOne({ email });
      if (exists) {
        throw new GraphQLError("User already exists", {
          extensions: { code: "USER_EXISTS" },
        });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        role: role || "PUBLIC",
        phone,
        organizationId,
        active: true,
        emailVerified: false,
      });

      // Generate OTP for email verification
      const otpCode = otpService.generateOTP();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await otpService.storeOTP(app, domain, email, otpCode);

      user.lastOTPSentAt = new Date();
      await user.save();

      // Generate tokens using the utility (7 days expiry)
      const { accessToken, refreshToken } = generateTokens({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Send welcome email with OTP
      const html = createWelcomeEmail(name, user.role, otpCode, expiresAt);
      sendEmail(email, "Welcome to PHEOCConnect", html).catch(console.error);

      return {
        accessToken,
        refreshToken,
        requiresMFA: true,
        user: toId(user.toObject()),
      };
    },

    /* ============================================
     USER MANAGEMENT (Admin only)
    ============================================ */

    async updateUserRole(_, { userId, role }, context) {
      // Check authentication and authorization
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "SUPER_ADMIN"
      ) {
        throw new GraphQLError("Not authorized to update user roles", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      if (!isValidObjectId(userId)) {
        throw new GraphQLError("Invalid user ID", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const oldRole = user.role;
      const updated = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true },
      );

      // Send email notification
      const html = createRoleChangeEmail(
        user.name,
        oldRole,
        role,
        context.user.email,
      );
      await sendEmail(user.email, "Role Updated", html);

      return toId(updated?.toObject());
    },

    async deactivateUser(_, { userId }, context) {
      if (!context.user || context.user.role !== "ADMIN") {
        throw new GraphQLError("Not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      if (!isValidObjectId(userId)) {
        throw new GraphQLError("Invalid user ID", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      user.active = false;
      await user.save();

      const html = createAccountDeactivationEmail(
        user.name,
        context.user.email,
      );
      await sendEmail(user.email, "Account Deactivated", html);

      return toId(user.toObject());
    },

    async reactivateUser(_, { userId }, context) {
      if (!context.user || context.user.role !== "ADMIN") {
        throw new GraphQLError("Not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      if (!isValidObjectId(userId)) {
        throw new GraphQLError("Invalid user ID", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      user.active = true;
      await user.save();

      const html = createAccountReactivationEmail(
        user.name,
        context.user.email,
      );
      await sendEmail(user.email, "Account Reactivated", html);

      return toId(user.toObject());
    },

    /* ============================================
     SESSION CONTROL
    ============================================ */

    async revokeAllSessions(_, __, context) {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      // Implementation would depend on your session management strategy
      return true;
    },

    async revokeDeviceSession(_, { sessionId }, context) {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (!sessionId) {
        throw new GraphQLError("Session ID required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Implementation would depend on your session management strategy
      return true;
    },
  },
};

export default userResolver;
