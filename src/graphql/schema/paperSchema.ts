import { gql } from "apollo-server-express";

export const paperTypeDefs = gql`
  # ============================================
  # ENUMS
  # ============================================

  enum PaperRegistrationStatusEnum {
    PENDING
    APPROVED
    REJECTED
  }

  enum PaperStatusEnum {
    DRAFT
    PENDING_APPROVAL
    ACTIVE
    COMPLETED
    CANCELLED
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
  type Annotation {
    id: ID!
    paperId: ID!
    page: Int!
    rect: PaperRect!
    title: String
    text: String!
    author: PaperAuthorInfo!
    reactions: [PaperReaction!]!
    createdAt: String!
    updatedAt: String
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

  type PaperLiveSession {
    isActive: Boolean!
    startedAt: String
    endedAt: String
    currentPage: Int
    activeAnnotationId: ID
    controller: PaperUser
    participants: [PaperUser!]!
  }

  # ============================================
  # ACCESS MANAGEMENT
  # ============================================

  type PaperAccessRequest {
    id: ID!
    email: String!
    name: String!
    reason: String
    requestedAt: String!
    status: String!
    approvedAt: String
    deniedAt: String
  }

  type PaperApprovedCollaborator {
    email: String!
    name: String!
    approvedAt: String!
    approvedBy: PaperUser!
  }

  # ============================================
  # PARTICIPANT MANAGEMENT
  # ============================================

  type PaperPreRegistrationDetail {
    id: ID!
    sessionId: String!
    userId: String
    name: String!
    emailAddress: String!
    email: String
    courseTaken: String
    level: String
    registeredAt: String!
    responses: String
    status: PaperRegistrationStatusEnum!
    approvalToken: String!
    registeredVia: String
    approvedAt: String
  }

  type PaperSessionRegistration {
    id: ID!
    sessionId: String!
    email: String!
    name: String!
    courseTaken: String
    level: String
    registeredAt: String!
    status: PaperRegistrationStatusEnum!
    approvalToken: String!
    approvedAt: String
    registeredVia: String
  }

  type PaperWaitingListResponse {
    registrations: [PaperPreRegistrationDetail!]!
    totalCount: Int!
    pendingCount: Int!
    approvedCount: Int!
    rejectedCount: Int!
  }

  type PaperAccessCheckResponse {
    hasAccess: Boolean!
    isSessionOpen: Boolean!
    isTimeReached: Boolean!
    message: String!
    paperDetails: PaperQRDetails
  }

  type PaperQRDetails {
    title: String!
    objective: String!
    sessionId: String!
  }

  # ============================================
  # PAPER REGISTRATION RESPONSE
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

  # ============================================
  # MAIN PAPER TYPE
  # ============================================

  type Paper {
    id: ID!
    title: String!
    objective: String!
    url: String
    accessKey: String!
    sessionId: String!
    createdBy: PaperUser!
    createdDate: String
    journalClubEventDate: String
    annotations: [PaperAnnotation!]!
    annotationCount: Int!
    liveSession: PaperLiveSession
    status: PaperStatusEnum!
    qrCodeUrl: String
    qrCodePdfPath: String
    joinUrl: String
    pendingRequests: [PaperAccessRequest!]!
    approvedCollaborators: [PaperApprovedCollaborator!]!
    participants: [PaperPreRegistrationDetail!]!
    waitingList: [PaperSessionRegistration!]!
    admittedParticipants: [PaperPreRegistrationDetail!]
    maxParticipants: Int
    isSessionOpen: Boolean
    sessionStartTime: String
    sessionEndTime: String
    availableSpots: Int
    isFull: Boolean
    participantCount: Int
    pendingRegistrationsCount: Int
    approvedRegistrationsCount: Int
    rejectedRegistrationsCount: Int
  }

  # ============================================
  # USER
  # ============================================

  type PaperUser {
    id: ID!
    name: String!
    email: String!
    personalInfo: PaperPersonalInfo
  }

  type PaperPersonalInfo {
    email: String
    fullName: String
  }

  # ============================================
  # RESPONSES
  # ============================================

  type PaperAccessRequestResponse {
    success: Boolean!
    message: String!
    requestId: ID
    status: PaperRegistrationStatusEnum
  }

  type PaperQRCodeResponse {
    success: Boolean!
    message: String!
    qrCodeUrl: String
    qrCodePdfPath: String
    joinUrl: String
  }

  type CreatePaperResponse {
    paper: Paper!
    qrCodeUrl: String!
    qrCodePdfPath: String!
    joinUrl: String!
    sessionId: String!
    accessKey: String!
  }

  type PaperApprovalResponse {
    success: Boolean!
    message: String!
  }

  # ============================================
  # INPUTS
  # ============================================

  input RegisterForPaperSessionInput {
    sessionId: String!
    email: String!
    name: String!
    courseTaken: String
    level: String
  }

  # ============================================
  # QUERIES
  # ============================================

  type Query {
    getPaper(id: ID!): Paper
    getPapers: [Paper]
    getLivePaper(accessKey: String!): Paper
    getMostRecentPapers(limit: Int): [Paper!]!
    getPaperBySession(sessionId: String!): Paper
    getPaperAnnotations(
      paperId: ID!
      page: Int
      limit: Int
    ): [PaperAnnotation!]!
    getMyPaperAnnotations: [PaperAnnotation!]!
    getPaperPendingAccessRequests(paperId: ID!): [PaperAccessRequest!]!
    getPaperApprovedCollaborators(paperId: ID!): [PaperApprovedCollaborator!]!
    checkPaperAccess(sessionId: String!, email: String!): Boolean!
    getPaperWaitingList(paperId: ID!): PaperWaitingListResponse!
    checkPaperSessionAccess(
      sessionId: String!
      email: String!
    ): PaperAccessCheckResponse!
    checkPaperRegistrationStatus(
      paperId: ID!
      email: String!
    ): PaperRegistrationResponse!
    getPaperPendingRegistrations(paperId: ID!): [PaperPreRegistrationDetail!]!
  }

  # ============================================
  # MUTATIONS
  # ============================================

  type Mutation {
    createPaper(
      createdBy: ID!
      title: String!
      objective: String!
      url: String
      maxParticipants: Int
    ): CreatePaperResponse!

    updatePaper(
      id: ID!
      title: String
      objective: String
      createdDate: String
      maxParticipants: Int
    ): Paper

    deletePaper(id: ID!): Paper

    requestPaperAccess(
      sessionId: String!
      email: String!
      name: String
      reason: String
    ): PaperAccessRequestResponse!

    approvePaperAccess(
      paperId: ID!
      requestId: ID!
    ): PaperAccessRequestResponse!

    denyPaperAccess(paperId: ID!, requestId: ID!): PaperAccessRequestResponse!

    processPaperRegistrations(
      paperId: ID!
      registrationIds: [ID!]!
      action: String!
    ): PaperApprovalResponse!

    openPaperSession(paperId: ID!): Paper!
    closePaperSession(paperId: ID!): Paper!

    createPaperAnnotation(
      paperId: ID!
      page: Int!
      x: Float!
      y: Float!
      width: Float!
      height: Float!
      title: String
      text: String!
    ): PaperAnnotation!

    updatePaperAnnotation(
      id: ID!
      text: String!
      title: String
    ): PaperAnnotation!
    deletePaperAnnotation(id: ID!): Boolean!

    addPaperReaction(
      annotationId: ID!
      type: String!
      text: String
    ): PaperReaction!
    removePaperReaction(id: ID!): Boolean!

    startPaperSession(paperId: ID!): PaperLiveSession!
    endPaperSession(paperId: ID!): PaperLiveSession!
    joinPaperSession(paperId: ID!): PaperLiveSession!
    leavePaperSession(paperId: ID!): PaperLiveSession!
    navigatePaperSession(paperId: ID!, page: Int!): PaperLiveSession!
  }
`;

export default paperTypeDefs;
