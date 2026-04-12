// resolvers/liveSessionResolver.ts
import LiveSession, {
  LiveSessionStatus,
  ParticipantRole,
  ResourceType,
  ILiveSession,
} from "../../models/LiveSession";
import User from "../../models/User";
import { Types } from "mongoose";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

// Event topics
const SESSION_TOPICS = {
  NAVIGATION_UPDATED: "NAVIGATION_UPDATED",
  PARTICIPANT_JOINED: "PARTICIPANT_JOINED",
  PARTICIPANT_LEFT: "PARTICIPANT_LEFT",
  SESSION_STATUS_CHANGED: "SESSION_STATUS_CHANGED",
};

export const liveSessionResolver = {
  Query: {
    // Get live session by ID
    async liveSession(_: any, { id }: { id: string }) {
      try {
        const session = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "moderatorIds",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        if (!session) {
          throw new Error("Live session not found");
        }

        return session;
      } catch (error) {
        console.error("Error fetching live session:", error);
        throw new Error("Failed to fetch live session");
      }
    },

    // Get active session for a resource
    async activeLiveSession(
      _: any,
      {
        resourceId,
        resourceType,
      }: { resourceId: string; resourceType: ResourceType },
    ) {
      try {
        const session = await LiveSession.findOne({
          resourceId,
          resourceType,
          status: LiveSessionStatus.ACTIVE,
        })
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "moderatorIds",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return session;
      } catch (error) {
        console.error("Error fetching active session:", error);
        throw new Error("Failed to fetch active session");
      }
    },

    // Get all sessions for a resource
    async resourceLiveSessions(
      _: any,
      {
        resourceId,
        resourceType,
      }: { resourceId: string; resourceType: ResourceType },
    ) {
      try {
        const sessions = await LiveSession.find({
          resourceId,
          resourceType,
        })
          .sort({ createdAt: -1 })
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return sessions;
      } catch (error) {
        console.error("Error fetching resource sessions:", error);
        throw new Error("Failed to fetch resource sessions");
      }
    },

    // Get user's active sessions
    async myActiveLiveSessions(_: any, __: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const sessions = await LiveSession.find({
          "participants.userId": user.id,
          status: LiveSessionStatus.ACTIVE,
          "participants.leftAt": { $exists: false },
        })
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return sessions;
      } catch (error) {
        console.error("Error fetching user active sessions:", error);
        throw new Error("Failed to fetch active sessions");
      }
    },

    // Get upcoming sessions
    async upcomingLiveSessions(_: any, { limit = 10 }: { limit: number }) {
      try {
        const sessions = await LiveSession.find({
          status: LiveSessionStatus.SCHEDULED,
          scheduledStartTime: { $gt: new Date() },
        })
          .sort({ scheduledStartTime: 1 })
          .limit(limit)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return sessions;
      } catch (error) {
        console.error("Error fetching upcoming sessions:", error);
        throw new Error("Failed to fetch upcoming sessions");
      }
    },
  },

  Mutation: {
    // Create a live session
    async createLiveSession(_: any, { input }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = new LiveSession({
          resourceId: input.resourceId,
          resourceType: input.resourceType,
          title: input.title,
          description: input.description,
          status: LiveSessionStatus.SCHEDULED,
          scheduledStartTime: input.scheduledStartTime
            ? new Date(input.scheduledStartTime)
            : undefined,
          scheduledEndTime: input.scheduledEndTime
            ? new Date(input.scheduledEndTime)
            : undefined,
          controllerId: user.id,
          moderatorIds: [user.id],
          maxParticipants: input.maxParticipants || 100,
          allowAnonymous: input.allowAnonymous || false,
          requireApproval: input.requireApproval || false,
          featuresEnabled: {
            chat: input.featuresEnabled?.chat ?? true,
            screenShare: input.featuresEnabled?.screenShare ?? false,
            annotation: input.featuresEnabled?.annotation ?? true,
            raiseHand: input.featuresEnabled?.raiseHand ?? true,
            polling: input.featuresEnabled?.polling ?? false,
            breakoutRooms: input.featuresEnabled?.breakoutRooms ?? false,
          },
          navigationState: {
            currentPosition: "0",
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          metadata: input.metadata || new Map(),
          participants: [],
          participantCount: 0,
          messageCount: 0,
          reactionCount: 0,
        });

        await session.save();

        const populatedSession = await LiveSession.findById(session._id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "moderatorIds",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error creating live session:", error);
        throw new Error("Failed to create live session");
      }
    },

    // Update live session
    async updateLiveSession(_: any, { id, input }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to update this session");
        }

        const updateData: any = {};
        if (input.title) updateData.title = input.title;
        if (input.description !== undefined)
          updateData.description = input.description;
        if (input.scheduledStartTime)
          updateData.scheduledStartTime = new Date(input.scheduledStartTime);
        if (input.scheduledEndTime)
          updateData.scheduledEndTime = new Date(input.scheduledEndTime);
        if (input.maxParticipants)
          updateData.maxParticipants = input.maxParticipants;
        if (input.featuresEnabled) {
          updateData["featuresEnabled.chat"] = input.featuresEnabled.chat;
          updateData["featuresEnabled.screenShare"] =
            input.featuresEnabled.screenShare;
          updateData["featuresEnabled.annotation"] =
            input.featuresEnabled.annotation;
          updateData["featuresEnabled.raiseHand"] =
            input.featuresEnabled.raiseHand;
          updateData["featuresEnabled.polling"] = input.featuresEnabled.polling;
          updateData["featuresEnabled.breakoutRooms"] =
            input.featuresEnabled.breakoutRooms;
        }
        if (input.metadata) updateData.metadata = input.metadata;

        const updatedSession = await LiveSession.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true },
        )
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "moderatorIds",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return updatedSession;
      } catch (error) {
        console.error("Error updating live session:", error);
        throw new Error("Failed to update live session");
      }
    },

    // Delete live session
    async deleteLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization (only controller can delete)
        if (session.controllerId?.toString() !== user.id) {
          throw new Error("Only session controller can delete this session");
        }

        await session.deleteOne();
        return true;
      } catch (error) {
        console.error("Error deleting live session:", error);
        throw new Error("Failed to delete live session");
      }
    },

    // Start live session
    async startLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to start this session");
        }

        // Start session - direct update
        session.status = LiveSessionStatus.ACTIVE;
        session.actualStartTime = new Date();
        await session.save();

        // Publish event
        pubsub.publish(`${SESSION_TOPICS.SESSION_STATUS_CHANGED}.${id}`, {
          sessionStatusChanged: session.status,
        });

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error starting session:", error);
        throw new Error("Failed to start session");
      }
    },

    // Pause live session
    async pauseLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to pause this session");
        }

        // Pause session - direct update
        session.status = LiveSessionStatus.PAUSED;
        await session.save();

        pubsub.publish(`${SESSION_TOPICS.SESSION_STATUS_CHANGED}.${id}`, {
          sessionStatusChanged: session.status,
        });

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error pausing session:", error);
        throw new Error("Failed to pause session");
      }
    },

    // Resume live session
    async resumeLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to resume this session");
        }

        // Resume session - direct update
        session.status = LiveSessionStatus.ACTIVE;
        await session.save();

        pubsub.publish(`${SESSION_TOPICS.SESSION_STATUS_CHANGED}.${id}`, {
          sessionStatusChanged: session.status,
        });

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error resuming session:", error);
        throw new Error("Failed to resume session");
      }
    },

    // End live session
    async endLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to end this session");
        }

        // End session - direct update
        session.status = LiveSessionStatus.ENDED;
        session.actualEndTime = new Date();

        // Calculate duration
        if (session.actualStartTime) {
          session.duration = Math.floor(
            (session.actualEndTime.getTime() -
              session.actualStartTime.getTime()) /
              60000,
          );
        }

        await session.save();

        pubsub.publish(`${SESSION_TOPICS.SESSION_STATUS_CHANGED}.${id}`, {
          sessionStatusChanged: session.status,
        });

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error ending session:", error);
        throw new Error("Failed to end session");
      }
    },

    // Join live session
    async joinLiveSession(_: any, { id, role }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        if (session.status !== LiveSessionStatus.ACTIVE) {
          throw new Error("Session is not active");
        }

        // Check if user already in session
        const existingParticipant = session.participants.find(
          (p: any) => p.userId.toString() === user.id && !p.leftAt,
        );

        if (existingParticipant) {
          throw new Error("Already joined this session");
        }

        // Check if user has left but not removed
        const leftParticipant = session.participants.find(
          (p: any) => p.userId.toString() === user.id && p.leftAt,
        );

        if (leftParticipant) {
          // Rejoin
          leftParticipant.leftAt = undefined;
          leftParticipant.lastActiveAt = new Date();
          leftParticipant.role = role || ParticipantRole.PARTICIPANT;
        } else {
          // Add new participant
          session.participants.push({
            userId: new Types.ObjectId(user.id),
            role: role || ParticipantRole.PARTICIPANT,
            joinedAt: new Date(),
            lastActiveAt: new Date(),
          });
        }

        session.participantCount = session.participants.filter(
          (p: any) => !p.leftAt,
        ).length;
        await session.save();

        // Publish participant joined event
        pubsub.publish(`${SESSION_TOPICS.PARTICIPANT_JOINED}.${id}`, {
          participantJoined: {
            userId: user.id,
            role: role || ParticipantRole.PARTICIPANT,
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          },
        });

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error joining session:", error);
        throw new Error("Failed to join session");
      }
    },

    // Leave live session
    async leaveLiveSession(_: any, { id }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(id);
        if (!session) {
          throw new Error("Live session not found");
        }

        const participant = session.participants.find(
          (p: any) => p.userId.toString() === user.id,
        );

        if (participant && !participant.leftAt) {
          participant.leftAt = new Date();
          session.participantCount = session.participants.filter(
            (p: any) => !p.leftAt,
          ).length;
          await session.save();

          // Publish participant left event
          pubsub.publish(`${SESSION_TOPICS.PARTICIPANT_LEFT}.${id}`, {
            participantLeft: {
              userId: user.id,
              leftAt: new Date().toISOString(),
            },
          });
        }

        const populatedSession = await LiveSession.findById(id)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error leaving session:", error);
        throw new Error("Failed to leave session");
      }
    },

    // Update participant role
    async updateParticipantRole(
      _: any,
      { sessionId, userId, role }: any,
      { user }: any,
    ) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(sessionId);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization (only controller or moderator can update roles)
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to update participant roles");
        }

        const participant = session.participants.find(
          (p: any) => p.userId.toString() === userId,
        );

        if (!participant) {
          throw new Error("Participant not found");
        }

        participant.role = role;
        await session.save();

        const populatedSession = await LiveSession.findById(sessionId)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error updating participant role:", error);
        throw new Error("Failed to update participant role");
      }
    },

    // Remove participant
    async removeParticipant(_: any, { sessionId, userId }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(sessionId);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization (only controller or moderator can remove participants)
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to remove participants");
        }

        // Remove participant completely
        session.participants = session.participants.filter(
          (p: any) => p.userId.toString() !== userId,
        );
        session.participantCount = session.participants.filter(
          (p: any) => !p.leftAt,
        ).length;
        await session.save();

        // Publish participant left event
        pubsub.publish(`${SESSION_TOPICS.PARTICIPANT_LEFT}.${sessionId}`, {
          participantLeft: {
            userId,
            leftAt: new Date().toISOString(),
          },
        });

        const populatedSession = await LiveSession.findById(sessionId)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .populate(
            "participants.userId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error removing participant:", error);
        throw new Error("Failed to remove participant");
      }
    },

    // Update navigation (presenter only)
    async updateNavigation(_: any, { sessionId, input }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(sessionId);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization (only controller/presenter can navigate)
        if (session.controllerId?.toString() !== user.id) {
          throw new Error("Only session controller can update navigation");
        }

        // Update navigation state - direct update
        session.navigationState = {
          currentPosition: input.currentPosition,
          activeItemId: input.activeItemId,
          viewport: input.viewport || session.navigationState.viewport,
          customState: input.customState || session.navigationState.customState,
        };

        await session.save();

        // Publish navigation update
        pubsub.publish(`${SESSION_TOPICS.NAVIGATION_UPDATED}.${sessionId}`, {
          navigationUpdated: session.navigationState,
        });

        const populatedSession = await LiveSession.findById(sessionId)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error updating navigation:", error);
        throw new Error("Failed to update navigation");
      }
    },

    // Start recording
    async startRecording(_: any, { sessionId }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(sessionId);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to start recording");
        }

        session.isRecording = true;
        await session.save();

        const populatedSession = await LiveSession.findById(sessionId)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error starting recording:", error);
        throw new Error("Failed to start recording");
      }
    },

    // Stop recording
    async stopRecording(_: any, { sessionId }: any, { user }: any) {
      try {
        if (!user || !user.id) {
          throw new Error("Not authenticated");
        }

        const session = await LiveSession.findById(sessionId);
        if (!session) {
          throw new Error("Live session not found");
        }

        // Check authorization
        if (
          session.controllerId?.toString() !== user.id &&
          !session.moderatorIds?.some((m: any) => m.toString() === user.id)
        ) {
          throw new Error("Not authorized to stop recording");
        }

        session.isRecording = false;
        await session.save();

        const populatedSession = await LiveSession.findById(sessionId)
          .populate(
            "controllerId",
            "personalInfo.fullName personalInfo.username personalInfo.email",
          )
          .lean();

        return populatedSession;
      } catch (error) {
        console.error("Error stopping recording:", error);
        throw new Error("Failed to stop recording");
      }
    },
  },

  Subscription: {
    navigationUpdated: {
      subscribe: (_: any, { sessionId }: { sessionId: string }) =>
        pubsub.asyncIterator(
          `${SESSION_TOPICS.NAVIGATION_UPDATED}.${sessionId}`,
        ),
    },
    participantJoined: {
      subscribe: (_: any, { sessionId }: { sessionId: string }) =>
        pubsub.asyncIterator(
          `${SESSION_TOPICS.PARTICIPANT_JOINED}.${sessionId}`,
        ),
    },
    participantLeft: {
      subscribe: (_: any, { sessionId }: { sessionId: string }) =>
        pubsub.asyncIterator(`${SESSION_TOPICS.PARTICIPANT_LEFT}.${sessionId}`),
    },
    sessionStatusChanged: {
      subscribe: (_: any, { sessionId }: { sessionId: string }) =>
        pubsub.asyncIterator(
          `${SESSION_TOPICS.SESSION_STATUS_CHANGED}.${sessionId}`,
        ),
    },
  },

  // Field resolvers
  LiveSession: {
    async controller(parent: any) {
      if (parent.controllerId && typeof parent.controllerId === "object") {
        return parent.controllerId;
      }
      return await User.findById(parent.controllerId);
    },

    async moderators(parent: any) {
      if (parent.moderatorIds && Array.isArray(parent.moderatorIds)) {
        return parent.moderatorIds;
      }
      if (parent.moderatorIds && parent.moderatorIds.length > 0) {
        return await User.find({ _id: { $in: parent.moderatorIds } });
      }
      return [];
    },

    async participants(parent: any) {
      if (parent.participants && parent.participants.length > 0) {
        return parent.participants.map((p: any) => ({
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          lastActiveAt: p.lastActiveAt,
          metadata: p.metadata,
        }));
      }
      return [];
    },

    isLive(parent: any) {
      return parent.status === LiveSessionStatus.ACTIVE;
    },

    elapsedTime(parent: any) {
      if (!parent.actualStartTime) return 0;
      const end = parent.actualEndTime || new Date();
      return Math.floor(
        (new Date(end).getTime() - new Date(parent.actualStartTime).getTime()) /
          1000,
      );
    },

    remainingTime(parent: any) {
      if (!parent.scheduledEndTime) return null;
      const now = new Date();
      if (now > new Date(parent.scheduledEndTime)) return 0;
      return Math.floor(
        (new Date(parent.scheduledEndTime).getTime() - now.getTime()) / 1000,
      );
    },
  },

  Participant: {
    async userId(parent: any) {
      if (parent.userId && typeof parent.userId === "object") {
        return parent.userId;
      }
      return await User.findById(parent.userId);
    },
  },
};

export default liveSessionResolver;
