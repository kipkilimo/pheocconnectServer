// models/LiveSession.ts
import mongoose, { Document, Schema, Types } from "mongoose";

// ============================================
// ENUMS
// ============================================

export enum LiveSessionStatus {
  SCHEDULED = "SCHEDULED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  ENDED = "ENDED",
  CANCELLED = "CANCELLED",
}

export enum ParticipantRole {
  PRESENTER = "PRESENTER",
  MODERATOR = "MODERATOR",
  PARTICIPANT = "PARTICIPANT",
  OBSERVER = "OBSERVER",
}

export enum ResourceType {
  PAPER = "PAPER",
  GROUP_REVISION = "GROUP_REVISION",
  CODING_HACKATHON = "CODING_HACKATHON",
  WORKSHOP = "WORKSHOP",
  LECTURE = "LECTURE",
  MEETING = "MEETING",
}

// ============================================
// INTERFACES
// ============================================

export interface IParticipant {
  userId: Types.ObjectId;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt?: Date;
  lastActiveAt: Date;
  metadata?: Map<string, any>; // Flexible metadata for resource-specific needs
}

export interface INavigationState {
  currentPosition: string | number; // Could be page number, line number, slide index, etc.
  activeItemId?: Types.ObjectId; // Could be annotationId, codeBlockId, revisionId, etc.
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  customState?: Map<string, any>; // Resource-specific navigation state
}

export interface ILiveSession extends Document {
  // Core identification
  resourceId: Types.ObjectId;
  resourceType: ResourceType;

  // Session metadata
  title: string;
  description?: string;
  status: LiveSessionStatus;

  // Timing
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  duration?: number; // in minutes

  // Participants
  controllerId: Types.ObjectId; // The one who controls navigation
  moderatorIds: Types.ObjectId[]; // Multiple moderators
  participants: IParticipant[];
  maxParticipants?: number;

  // Navigation state (resource-agnostic)
  navigationState: INavigationState;

  // Real-time collaboration settings
  isRecording: boolean;
  recordingUrl?: string;
  allowAnonymous: boolean;
  requireApproval: boolean;

  // Features enabled
  featuresEnabled: {
    chat: boolean;
    screenShare: boolean;
    annotation: boolean;
    raiseHand: boolean;
    polling: boolean;
    breakoutRooms: boolean;
  };

  // WebRTC/Signaling
  rtcConfiguration?: {
    iceServers: any[];
    roomId: string;
  };

  // Metadata for resource-specific data
  metadata: Map<string, any>;

  // Analytics
  participantCount: number;
  messageCount: number;
  reactionCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SCHEMA DEFINITIONS
// ============================================

const ParticipantSchema = new Schema<IParticipant>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: Object.values(ParticipantRole),
    default: ParticipantRole.PARTICIPANT,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  leftAt: {
    type: Date,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
});

const NavigationStateSchema = new Schema<INavigationState>({
  currentPosition: {
    type: Schema.Types.Mixed, // Can be number, string, etc.
    required: true,
    default: 0,
  },
  activeItemId: {
    type: Schema.Types.ObjectId,
    refPath: "resourceType", // Dynamic reference based on resource type
  },
  viewport: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    zoom: { type: Number, default: 1 },
  },
  customState: {
    type: Map,
    of: Schema.Types.Mixed,
    default: new Map(),
  },
});

const FeaturesEnabledSchema = new Schema({
  chat: { type: Boolean, default: true },
  screenShare: { type: Boolean, default: false },
  annotation: { type: Boolean, default: true },
  raiseHand: { type: Boolean, default: true },
  polling: { type: Boolean, default: false },
  breakoutRooms: { type: Boolean, default: false },
});

const LiveSessionSchema = new Schema<ILiveSession>(
  {
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: Object.values(ResourceType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(LiveSessionStatus),
      default: LiveSessionStatus.SCHEDULED,
      index: true,
    },
    scheduledStartTime: {
      type: Date,
    },
    scheduledEndTime: {
      type: Date,
    },
    actualStartTime: {
      type: Date,
    },
    actualEndTime: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    controllerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    moderatorIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    participants: [ParticipantSchema],
    maxParticipants: {
      type: Number,
      default: 100,
    },
    navigationState: {
      type: NavigationStateSchema,
      required: true,
      default: () => ({ currentPosition: 0 }),
    },
    isRecording: {
      type: Boolean,
      default: false,
    },
    recordingUrl: {
      type: String,
    },
    allowAnonymous: {
      type: Boolean,
      default: false,
    },
    requireApproval: {
      type: Boolean,
      default: false,
    },
    featuresEnabled: {
      type: FeaturesEnabledSchema,
      default: () => ({}),
    },
    rtcConfiguration: {
      iceServers: [
        {
          urls: [String],
          username: String,
          credential: String,
        },
      ],
      roomId: String,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    reactionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================
// INDEXES
// ============================================

// Compound index for finding sessions by resource
LiveSessionSchema.index({ resourceId: 1, resourceType: 1 });

// Index for active sessions
LiveSessionSchema.index({ status: 1, actualStartTime: -1 });

// Index for scheduled sessions
LiveSessionSchema.index({ scheduledStartTime: 1, status: 1 });

// Index for participant lookups
LiveSessionSchema.index({ "participants.userId": 1 });

// ============================================
// VIRTUALS
// ============================================

LiveSessionSchema.virtual("isLive").get(function (this: ILiveSession) {
  return this.status === LiveSessionStatus.ACTIVE;
});

LiveSessionSchema.virtual("elapsedTime").get(function (this: ILiveSession) {
  if (!this.actualStartTime) return 0;
  const end = this.actualEndTime || new Date();
  return Math.floor((end.getTime() - this.actualStartTime.getTime()) / 1000);
});

LiveSessionSchema.virtual("remainingTime").get(function (this: ILiveSession) {
  if (!this.scheduledEndTime) return null;
  const now = new Date();
  if (now > this.scheduledEndTime) return 0;
  return Math.floor((this.scheduledEndTime.getTime() - now.getTime()) / 1000);
});

// ============================================
// METHODS
// ============================================

LiveSessionSchema.methods = {
  // Add participant
  async addParticipant(
    userId: Types.ObjectId,
    role: ParticipantRole = ParticipantRole.PARTICIPANT,
  ): Promise<boolean> {
    const existing = this.participants.find(
      (p: IParticipant) => p.userId.toString() === userId.toString(),
    );

    if (existing) {
      if (existing.leftAt) {
        existing.leftAt = undefined;
        existing.lastActiveAt = new Date();
      }
      await this.save();
      return true;
    }

    if (
      this.maxParticipants &&
      this.participants.length >= this.maxParticipants
    ) {
      throw new Error("Maximum participants reached");
    }

    this.participants.push({
      userId,
      role,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
    });

    this.participantCount = this.participants.filter(
      (p: { leftAt: any }) => !p.leftAt,
    ).length;
    await this.save();
    return true;
  },

  // Remove participant
  async removeParticipant(userId: Types.ObjectId): Promise<boolean> {
    const participant = this.participants.find(
      (p: IParticipant) => p.userId.toString() === userId.toString(),
    );

    if (participant && !participant.leftAt) {
      participant.leftAt = new Date();
      this.participantCount = this.participants.filter(
        (p: { leftAt: any }) => !p.leftAt,
      ).length;
      await this.save();
      return true;
    }

    return false;
  },

  // Start session
  async startSession(): Promise<void> {
    if (this.status === LiveSessionStatus.ACTIVE) {
      throw new Error("Session already active");
    }

    this.status = LiveSessionStatus.ACTIVE;
    this.actualStartTime = new Date();
    await this.save();
  },

  // Pause session
  async pauseSession(): Promise<void> {
    if (this.status !== LiveSessionStatus.ACTIVE) {
      throw new Error("Only active sessions can be paused");
    }

    this.status = LiveSessionStatus.PAUSED;
    await this.save();
  },

  // Resume session
  async resumeSession(): Promise<void> {
    if (this.status !== LiveSessionStatus.PAUSED) {
      throw new Error("Only paused sessions can be resumed");
    }

    this.status = LiveSessionStatus.ACTIVE;
    await this.save();
  },

  // End session
  async endSession(): Promise<void> {
    this.status = LiveSessionStatus.ENDED;
    this.actualEndTime = new Date();

    if (this.actualStartTime) {
      this.duration = Math.floor(
        (this.actualEndTime.getTime() - this.actualStartTime.getTime()) / 60000,
      );
    }

    await this.save();
  },

  // Update navigation state
  async updateNavigation(
    currentPosition: string | number,
    activeItemId?: Types.ObjectId,
    viewport?: { x: number; y: number; zoom: number },
    customState?: Map<string, any>,
  ): Promise<void> {
    this.navigationState.currentPosition = currentPosition;
    if (activeItemId) this.navigationState.activeItemId = activeItemId;
    if (viewport) this.navigationState.viewport = viewport;
    if (customState) this.navigationState.customState = customState;
    await this.save();
  },

  // Check if user is controller
  isController(userId: Types.ObjectId): boolean {
    return this.controllerId.toString() === userId.toString();
  },

  // Check if user is moderator
  isModerator(userId: Types.ObjectId): boolean {
    return (
      this.moderatorIds.some(
        (id: { toString: () => string }) => id.toString() === userId.toString(),
      ) || this.isController(userId)
    );
  },

  // Get active participants
  getActiveParticipants(): IParticipant[] {
    return this.participants.filter((p: IParticipant) => !p.leftAt);
  },

  // Increment message count
  async incrementMessageCount(): Promise<void> {
    this.messageCount += 1;
    await this.save();
  },

  // Increment reaction count
  async incrementReactionCount(): Promise<void> {
    this.reactionCount += 1;
    await this.save();
  },
};

// ============================================
// STATICS
// ============================================

LiveSessionSchema.statics = {
  // Find active sessions for a resource
  async findActiveSession(
    resourceId: Types.ObjectId,
    resourceType: ResourceType,
  ) {
    return this.findOne({
      resourceId,
      resourceType,
      status: LiveSessionStatus.ACTIVE,
    });
  },

  // Find all sessions for a resource
  async findResourceSessions(
    resourceId: Types.ObjectId,
    resourceType: ResourceType,
  ) {
    return this.find({
      resourceId,
      resourceType,
    }).sort({ createdAt: -1 });
  },

  // Find user's active sessions
  async findUserActiveSessions(userId: Types.ObjectId) {
    return this.find({
      "participants.userId": userId,
      status: LiveSessionStatus.ACTIVE,
      "participants.leftAt": { $exists: false },
    });
  },

  // Get upcoming sessions
  async getUpcomingSessions(limit: number = 10) {
    return this.find({
      status: LiveSessionStatus.SCHEDULED,
      scheduledStartTime: { $gt: new Date() },
    })
      .sort({ scheduledStartTime: 1 })
      .limit(limit);
  },
};

// ============================================
// MIDDLEWARE
// ============================================

LiveSessionSchema.pre("save", function (next) {
  // Update participant count before saving
  if (this.isModified("participants")) {
    this.participantCount = this.participants.filter((p) => !p.leftAt).length;
  }
  next();
});

// ============================================
// EXPORT
// ============================================

export const LiveSession = mongoose.model<ILiveSession>(
  "LiveSession",
  LiveSessionSchema,
);
export default LiveSession;
