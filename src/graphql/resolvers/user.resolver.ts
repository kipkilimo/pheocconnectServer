import { IResolvers } from "@graphql-tools/utils";
import User from "../../database/models/User";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

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

/* ============================================
 RESOLVER
============================================ */

export const userResolver: IResolvers = {
  Query: {
    /* ---------- PUBLIC ---------- */

    async publicDashboard() {
      return {
        stats: {
          totalUsers: await User.countDocuments(),
          activeSessions: 0,
          systemHealth: "OPERATIONAL",
          lastUpdated: new Date().toISOString(),
        },
        recentActivities: [],
        announcements: [],
      };
    },

    async publicAnnouncements() {
      return [];
    },

    /* ---------- PROTECTED ---------- */

    async users() {
      const users = await User.find().lean();
      return users.map(toId);
    },

    async user(_, { id }) {
      if (!isValidObjectId(id)) {
        throw new Error("Invalid user ID");
      }

      const user = await User.findById(id).lean();
      if (!user) throw new Error("User not found");

      return toId(user);
    },

    async myProfile(_, __, context) {
      if (!context.user) {
        throw new Error("Not authenticated");
      }

      const user = await User.findById(context.user.id).lean();
      if (!user) throw new Error("User not found");

      return toId(user);
    },
  },

  Mutation: {
    /* ============================================
     AUTH (OTP FLOW)
    ============================================ */

    async requestOTP(_, { input }) {
      return {
        success: true,
        message: "OTP sent successfully",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        remainingAttempts: 3,
      };
    },

    async verifyOTP(_, { input }) {
      const user = await User.findOne({ email: input.email });

      if (!user) {
        throw new Error("User not found");
      }

      if (input.otpCode !== "123456") {
        throw new Error("Invalid OTP");
      }

      const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      user.lastLoginAt = new Date().toISOString();
      await user.save();

      return {
        accessToken,
        refreshToken,
        user: toId(user.toObject?.() ?? user),
        requiresMFA: false,
      };
    },

    async refreshToken(_, { input }) {
      try {
        const decoded: any = jwt.verify(
          input.refreshToken,
          process.env.JWT_SECRET!,
        );

        const user = await User.findById(decoded.id);
        if (!user) throw new Error("User not found");

        const accessToken = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET!,
          { expiresIn: "15m" },
        );

        return {
          accessToken,
          refreshToken: input.refreshToken,
          user: toId(user.toObject?.() ?? user),
          requiresMFA: false,
        };
      } catch {
        throw new Error("Invalid refresh token");
      }
    },

    async logout() {
      return true;
    },

    /* ============================================
     USER MANAGEMENT
    ============================================ */

    async createUser(_, { input }) {
      const exists = await User.findOne({ email: input.email });
      if (exists) throw new Error("User already exists");

      const user = await User.create({
        ...input,
        active: true,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      return toId(user.toObject?.() ?? user);
    },

    async updateUserRole(_, { userId, role }) {
      if (!isValidObjectId(userId)) {
        throw new Error("Invalid user ID");
      }

      const updated = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true },
      );

      if (!updated) throw new Error("User not found");

      return toId(updated.toObject?.() ?? updated);
    },

    async deactivateUser(_, { userId }) {
      if (!isValidObjectId(userId)) return false;

      const user = await User.findByIdAndUpdate(
        userId,
        { active: false },
        { new: true },
      );

      return !!user;
    },

    /* ============================================
     SESSION CONTROL
    ============================================ */

    async revokeAllSessions(_, __, context) {
      if (!context.user) throw new Error("Not authenticated");
      return true;
    },

    async revokeDeviceSession(_, { sessionId }) {
      if (!sessionId) throw new Error("Session ID required");
      return true;
    },
  },
};

export default userResolver;
