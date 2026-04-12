import { gql } from "graphql-tag";

const userTypeDefs = gql`
  scalar Date

  enum Role {
    STUDENT
    MENTOR
    FACULTY
    ASSISTANT
    ADMIN
    SUPER
  }

  type Location {
    city: String
    state: String
    country: String
  }

  type Publication {
    title: String
    journal: String
    year: Int
    url: String
  }

  type Collaboration {
    collaboratorName: String
    institution: String
    projectTitle: String
  }
  type VerifyTokenResponse {
    valid: Boolean!
    email: String
  }
  type PersonalInfo {
    id: ID!
    scholarId: String!
    fullName: String!
    email: String!
    institution: String
    department: String
    profilePicture: String
    bio: String
    dateOfBirth: String
    gender: String
    password: String
    publication_credits: String
    username: String!
    location: Location
    website: String
    activationToken: String
    resetToken: String
    tokenExpiry: String
    activatedAccount: Boolean
  }

  type AcademicInfo {
    researchInterests: [String!]
    publications: [Publication]
    ongoingProjects: [String]
    collaborations: [Collaboration]
  }

  type PrivacySettings {
    profileVisibility: String
  }

  type NotificationSettings {
    emailNotifications: Boolean
  }

  type AccountSettings {
    privacySettings: PrivacySettings!
    notificationSettings: NotificationSettings!
  }

  type ActivityInfo {
    lastLogin: Date
    accountCreationDate: Date!
  }

  type DiscussionGroup {
    id: ID!
    # Other fields
  }

  type Department {
    id: ID!
    # Other fields
  }

  type SubscriptionDetails {
    status: String
    expiry: Date
  }

  type User {
    id: ID!
    personalInfo: PersonalInfo
    academicInfo: AcademicInfo
    accountSettings: AccountSettings
    activityInfo: ActivityInfo
    role: Role

    discussion_groups: [DiscussionGroup]
    departments: [Department]

    favorite_resources: [Resource]
    recent_resources: [Resource]
    suggested_resources: [Resource]

    done_exams: [Resource]

    subscriptionDetails: SubscriptionDetails
    dailyResourceLimit: Int
    resourcesUsedToday: Int
    dailyLimitReset: Date
  }

  input ReviewInput {
    rating: Float!
    text: String!
  }

  type LoginResponse {
    user: User!
    accessToken: String!
  }

  type Query {
    getUser(scholarId: String!): User
    getUsers: [User]
    getCurrentUser(sessionId: String!): User
    verifyResetToken(token: String!): VerifyTokenResponse!
  }
  type Mutation {
    createUser(
      username: String!
      fullName: String!
      email: String!
      password: String!
    ): User
    updateUser(scholarId: String!, input: UpdateUserInput!): User
    login(email: String!, password: String!): LoginResponse
    activate(activationToken: String!): LoginResponse
    resetPassword(activationToken: String!, password: String!): LoginResponse
    requestPasswordReset(email: String!): User
    singleSignInRequest(email: String!): User
    singleSigninLogin(accessKey: String!): LoginResponse
    deleteUserByScholarId(scholarId: String!): User
    rebaseUserDocuments: RebaseResult # New mutation
    suggestResources(userId: String!): [Resource]
    addResourceToRecents(userId: String!, resourceId: String!): User!
    addResourceToFavorites(userId: String!, resourceId: String!): User!
    rateReviewResources(
      userId: String!
      resourceId: String!
      reviewDetails: ReviewInput!
    ): User!
  }

  # Add this new type for the response
  type RebaseResult {
    success: Boolean!
    message: String!
    usersProcessed: Int!
    errors: [String]
  }

  input LocationInput {
    city: String
    state: String
    country: String
  }

  input PublicationInput {
    title: String!
    journal: String!
    year: Int!
    url: String
  }

  input CollaborationInput {
    collaboratorName: String
    institution: String
    projectTitle: String
  }

  input PersonalInfoInput {
    scholarId: String
    fullName: String!
    email: String!
    institution: String
    department: String
    profilePicture: String
    bio: String
    dateOfBirth: Date
    gender: String
    location: LocationInput
    website: String
    activationToken: String
    resetToken: String
    tokenExpiry: Date
    activatedAccount: Boolean
  }

  input AcademicInfoInput {
    researchInterests: [String!]!
    publications: [PublicationInput]
    ongoingProjects: [String]
    collaborations: [CollaborationInput]
  }

  input PrivacySettingsInput {
    profileVisibility: String!
  }

  input NotificationSettingsInput {
    emailNotifications: Boolean!
  }

  input AccountSettingsInput {
    privacySettings: PrivacySettingsInput!
    notificationSettings: NotificationSettingsInput!
  }

  input ActivityInfoInput {
    lastLogin: Date
    accountCreationDate: Date!
  }

  input SubscriptionDetailsInput {
    status: String
    expiry: Date
  }

  input UpdateUserInput {
    personalInfo: PersonalInfoInput!
    academicInfo: AcademicInfoInput!
    accountSettings: AccountSettingsInput!
    activityInfo: ActivityInfoInput!
    role: Role!
    subscriptionDetails: SubscriptionDetailsInput
    dailyResourceLimit: Int
    resourcesUsedToday: Int
    dailyLimitReset: Date
  }
`;

export default userTypeDefs;
