// graphql/liveSession.ts
import { gql } from "apollo-server-express";

export const liveSessionTypeDefs = gql`
  # ============================================
  # ENUMS
  # ============================================

  enum LiveSessionStatus {
    SCHEDULED
    ACTIVE
    PAUSED
    ENDED
    CANCELLED
  }

  enum ParticipantRole {
    PRESENTER
    MODERATOR
    PARTICIPANT
    OBSERVER
  }

  enum ResourceType {
    PAPER
    GROUP_REVISION
    CODING_HACKATHON
    WORKSHOP
    LECTURE
    MEETING
  }

  # ============================================
  # TYPES
  # ============================================

  type Participant {
    userId: User!
    role: ParticipantRole!
    joinedAt: String!
    leftAt: String
    lastActiveAt: String!
    metadata: JSON
  }

  type NavigationState {
    currentPosition: String! # Can be page number, line number, slide index, etc.
    activeItemId: ID
    viewport: Viewport
    customState: JSON
  }

  type Viewport {
    x: Float!
    y: Float!
    zoom: Float!
  }

  type FeaturesEnabled {
    chat: Boolean!
    screenShare: Boolean!
    annotation: Boolean!
    raiseHand: Boolean!
    polling: Boolean!
    breakoutRooms: Boolean!
  }

  type RTConfiguration {
    iceServers: [ICEServer!]!
    roomId: String!
  }

  type ICEServer {
    urls: [String!]!
    username: String
    credential: String
  }

  type LiveSession {
    id: ID!

    # Core
    resourceId: ID!
    resourceType: ResourceType!
    title: String!
    description: String
    status: LiveSessionStatus!

    # Timing
    scheduledStartTime: String
    scheduledEndTime: String
    actualStartTime: String
    actualEndTime: String
    duration: Int # in minutes
    # Participants
    controller: User!
    moderators: [User!]!
    participants: [Participant!]!
    maxParticipants: Int
    participantCount: Int!

    # State
    navigationState: NavigationState!

    # Features
    isRecording: Boolean!
    recordingUrl: String
    allowAnonymous: Boolean!
    requireApproval: Boolean!
    featuresEnabled: FeaturesEnabled!
    rtcConfiguration: RTConfiguration

    # Metadata
    metadata: JSON

    # Analytics
    messageCount: Int!
    reactionCount: Int!

    # Virtuals
    isLive: Boolean!
    elapsedTime: Int! # seconds
    remainingTime: Int # seconds
    # Timestamps
    createdAt: String!
    updatedAt: String!
  }

  # ============================================
  # INPUTS
  # ============================================

  input CreateLiveSessionInput {
    resourceId: ID!
    resourceType: ResourceType!
    title: String!
    description: String
    scheduledStartTime: String
    scheduledEndTime: String
    maxParticipants: Int
    allowAnonymous: Boolean
    requireApproval: Boolean
    featuresEnabled: FeaturesEnabledInput
    metadata: JSON
  }

  input FeaturesEnabledInput {
    chat: Boolean
    screenShare: Boolean
    annotation: Boolean
    raiseHand: Boolean
    polling: Boolean
    breakoutRooms: Boolean
  }

  input UpdateLiveSessionInput {
    title: String
    description: String
    scheduledStartTime: String
    scheduledEndTime: String
    maxParticipants: Int
    featuresEnabled: FeaturesEnabledInput
    metadata: JSON
  }

  input UpdateNavigationInput {
    currentPosition: String!
    activeItemId: ID
    viewport: ViewportInput
    customState: JSON
  }

  input ViewportInput {
    x: Float!
    y: Float!
    zoom: Float!
  }

  # ============================================
  # QUERIES
  # ============================================

  extend type Query {
    # Get live session by ID
    liveSession(id: ID!): LiveSession

    # Get active session for a resource
    activeLiveSession(resourceId: ID!, resourceType: ResourceType!): LiveSession

    # Get all sessions for a resource
    resourceLiveSessions(
      resourceId: ID!
      resourceType: ResourceType!
    ): [LiveSession!]!

    # Get user's active sessions
    myActiveLiveSessions: [LiveSession!]!

    # Get upcoming sessions
    upcomingLiveSessions(limit: Int): [LiveSession!]!
  }

  # ============================================
  # MUTATIONS
  # ============================================

  extend type Mutation {
    # Create a live session
    createLiveSession(input: CreateLiveSessionInput!): LiveSession!

    # Update live session
    updateLiveSession(id: ID!, input: UpdateLiveSessionInput!): LiveSession!

    # Delete live session
    deleteLiveSession(id: ID!): Boolean!

    # Session control
    startLiveSession(id: ID!): LiveSession!
    pauseLiveSession(id: ID!): LiveSession!
    resumeLiveSession(id: ID!): LiveSession!
    endLiveSession(id: ID!): LiveSession!

    # Participant management
    joinLiveSession(id: ID!, role: ParticipantRole): LiveSession!
    leaveLiveSession(id: ID!): LiveSession!
    updateParticipantRole(
      sessionId: ID!
      userId: ID!
      role: ParticipantRole!
    ): LiveSession!
    removeParticipant(sessionId: ID!, userId: ID!): LiveSession!

    # Navigation control (presenter only)
    updateNavigation(
      sessionId: ID!
      input: UpdateNavigationInput!
    ): LiveSession!

    # Recording
    startRecording(sessionId: ID!): LiveSession!
    stopRecording(sessionId: ID!): LiveSession!
  }

  # ============================================
  # SUBSCRIPTIONS
  # ============================================

  extend type Subscription {
    # Navigation updates
    navigationUpdated(sessionId: ID!): NavigationState!

    # Participant updates
    participantJoined(sessionId: ID!): Participant!
    participantLeft(sessionId: ID!): Participant!

    # Session status updates
    sessionStatusChanged(sessionId: ID!): LiveSessionStatus!
  }
`;

export default liveSessionTypeDefs;
