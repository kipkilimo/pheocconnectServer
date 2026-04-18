import { gql } from "apollo-server-express";
import userTypeDefs from "./userSchema"; // Import your user schema

export const paperTypeDefs = gql`
  # ============================================
  # ENUMS
  # ============================================

  enum PaperRegistrationStatusEnum {
    PENDING
    WAITING
    APPROVED
    REJECTED
  }

  enum PaperStatusEnum {
    DRAFT
    ACTIVE
    COMPLETED
  }

  # ============================================
  # CORE TYPES
  # ============================================

  type PaperRect {
    x: Float!
    y: Float!
    width: Float!
    height: Float!
  }

  type PaperAuthorInfo {
    id: ID!
    name: String!
    email: String!
  }

  type PaperReaction {
    id: ID!
    type: String!
    text: String
    author: PaperAuthorInfo!
    createdAt: String!
  }

  type PaperAnnotation {
    id: ID!
    page: Int!
    rect: PaperRect!
    title: String
    text: String!
    author: PaperAuthorInfo!
    reactions: [PaperReaction!]!
    createdAt: String!
    updatedAt: String
  }

  # ============================================
  # REGISTRATION TYPE
  # ============================================

  type PaperRegistration {
    id: ID!
    sessionId: String!
    userId: String
    name: String!
    emailAddress: String!
    courseTaken: String
    level: String
    registeredAt: String!
    responses: String
    status: PaperRegistrationStatusEnum!
    approvalToken: String!
    registeredVia: String
    approvedAt: String
    rejectedAt: String
    # Token renewal tracking fields
    lastTokenIssuedAt: String
    lastToken: String
  }

  # ============================================
  # USER TYPE
  # ============================================

  # type PaperUser: User!

  # ============================================
  # MAIN PAPER TYPE
  # ============================================

  type Paper {
    id: ID!
    title: String!
    objective: String!
    sessionId: String!
    createdBy: User! # Use full User type
    qrCodeUrl: String!
    sessionStartTime: String! # required
    sessionEndTime: String!
    url: String!
    # Single source of truth
    registrations: [PaperRegistration!]!

    # Virtual fields (derived from registrations)
    participants: [PaperRegistration!]!
    waitingList: [PaperRegistration!]!
    pending: [PaperRegistration!]!
    participantCount: Int
    availableSpots: Int
    isFull: Boolean

    # Session settings
    maxParticipants: Int
    isSessionOpen: Boolean

    # Annotations
    annotations: [PaperAnnotation!]!
    annotationCount: Int!

    # Timestamps
    createdAt: String!
    updatedAt: String
  }

  # ============================================
  # INPUT TYPES
  # ============================================

  input CreatePaperInput {
    title: String!
    objective: String!
    createdBy: ID!
    url: String
    sessionStartTime: String! # required
    maxParticipants: Int
    isSessionOpen: Boolean
  }

  input RegisterForPaperSessionInput {
    sessionId: String!
    email: String!
    name: String!
    courseTaken: String
    level: String
  }

  input UpdatePaperInput {
    title: String
    objective: String
    maxParticipants: Int
    isSessionOpen: Boolean
  }

  # ============================================
  # RESPONSE TYPES
  # ============================================

  type PaperRegistrationResponse {
    success: Boolean!
    message: String!
    registrationId: ID
    status: PaperRegistrationStatusEnum
    approvalToken: String
    paperId: ID
    sessionId: String
  }

  type PaperRegistrationManageResponse {
    success: Boolean!
    message: String!
  }
  type TokenRenewalResponse {
    success: Boolean!
    token: String!
    expiresAt: String!
  }
  # ============================================
  # QUERIES
  # ============================================

  type Query {
    # Paper queries
    getPaper(id: ID!): Paper
    getPapers: [Paper!]!
    getPaperBySession(sessionId: String!): Paper
    getMostRecentPapers(id: ID!): [Paper]!

    # Registration queries
    checkPaperRegistrationStatus(
      paperId: ID!
      email: String!
    ): PaperRegistrationResponse!
  }

  # ============================================
  # MUTATIONS
  # ============================================

  type Mutation {
    # Paper mutations
    createPaper(input: CreatePaperInput!): Paper!
    updatePaper(id: ID!, input: UpdatePaperInput!): Paper
    deletePaper(id: ID!): Boolean!

    # Session mutations
    openPaperSession(paperId: ID!): Paper!
    closePaperSession(paperId: ID!): Paper!

    # Registration mutations
    registerForPaperdiveSession(
      input: RegisterForPaperSessionInput!
    ): PaperRegistrationResponse!
    managePaperRegistrations(
      paperId: ID!
      registrationIds: [ID!]!
    ): PaperRegistrationManageResponse!

    # Token management mutations (consider adding these)
    # renewAccessToken(registrationId: ID!): TokenRenewalResponse!
    renewWebSocketToken(
      registrationId: ID!
      paperId: ID!
    ): TokenRenewalResponse!
  }
`;

export default paperTypeDefs;
