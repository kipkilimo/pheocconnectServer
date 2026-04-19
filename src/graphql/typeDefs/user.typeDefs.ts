import { gql } from "graphql-tag";

export const userTypeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    organizationId: ID
    eocId: ID
    active: Boolean!
    emailVerified: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
    requiresMFA: Boolean!
  }

  type OTPResponse {
    success: Boolean!
    message: String!
    expiresAt: DateTime!
    remainingAttempts: Int
  }

  # ---------- PUBLIC ----------

  type PublicActivity {
    id: ID!
    title: String!
    timestamp: DateTime!
    type: String!
  }

  type Announcement {
    id: ID!
    title: String!
    content: String!
    publishedAt: DateTime!
  }

  type PublicDashboard {
    stats: DashboardStats!
    recentActivities: [PublicActivity!]!
    announcements: [Announcement!]!
  }

  type DashboardStats {
    totalUsers: Int!
    activeSessions: Int!
    systemHealth: String!
    lastUpdated: DateTime!
  }

  # ---------- INPUTS ----------

  input CreateUserInput {
    name: String!
    email: String!
    role: Role!
    organizationId: ID
    eocId: ID
  }

  input RequestOTPInput {
    email: String!
  }

  input VerifyOTPInput {
    email: String!
    otpCode: String!
    rememberDevice: Boolean
  }

  input RefreshTokenInput {
    refreshToken: String!
  }

  # ---------- QUERIES ----------

  extend type Query {
    # Public
    publicDashboard: PublicDashboard!
    publicAnnouncements: [Announcement!]!

    # Protected
    users: [User!]! @auth(requires: [ADMIN, EOC_MANAGER])
    user(id: ID!): User @auth(requires: [ADMIN, EOC_MANAGER, ANALYST])
    myProfile: User! @auth
  }

  # ---------- MUTATIONS ----------

  extend type Mutation {
    # Auth
    requestOTP(input: RequestOTPInput!): OTPResponse!
    verifyOTP(input: VerifyOTPInput!): AuthPayload!
    refreshToken(input: RefreshTokenInput!): AuthPayload!
    logout: Boolean! @auth

    # User mgmt
    createUser(input: CreateUserInput!): User! @auth(requires: [ADMIN])
    updateUserRole(userId: ID!, role: Role!): User! @auth(requires: [ADMIN])
    deactivateUser(userId: ID!): Boolean! @auth(requires: [ADMIN, EOC_MANAGER])

    # Sessions
    revokeAllSessions: Boolean! @auth
    revokeDeviceSession(sessionId: ID!): Boolean! @auth
  }
`;