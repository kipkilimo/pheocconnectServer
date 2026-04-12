import { gql } from "graphql-tag";

export const consultationTypeDefs = gql`
  scalar DateTime

  enum StudyStage {
    CONCEPTUALIZATION
    PROPOSAL_DEVELOPMENT
    ETHICAL_CONSIDERATIONS
    POWER_SAMPLE_SIZE_CALCULATION
    FIELD_ACTIVITY
    REPORT_WRITING
    DISCUSSION
    MANUSCRIPT_DEVELOPMENT
  }

  enum ConsultStage {
    BILLING
    CONSULTING
    CLOSED
  }

  enum CourseTaken {
    MASTER_OF_SCIENCE
    MASTER_OF_MEDICINE
    MASTER_OF_PUBLIC_HEALTH
    MASTER_OF_ARTS
    DOCTOR_OF_PHILOSOPHY
  }

  enum InvoiceStatus {
    PENDING
    PAID
    OVERDUE
  }

  enum Methodology {
    QUANTITATIVE
    QUALITATIVE
    MIXED_METHODS
    SYSTEMATIC_REVIEW
    META_ANALYSIS
    OTHER
  }

  type DiscussionItem {
    id: ID!
    page: Int
    title: String
    text: String!
    x: Float
    y: Float
    width: Float
    height: Float
    author: String!
    timestamp: DateTime!
    editedAt: DateTime
  }

  type Invoice {
    amount: Float!
    status: InvoiceStatus!
    dueDate: DateTime!
    issuedAt: DateTime!
  }

  type Upload {
    id: ID!
    url: String!
    description: String
    discussion: [DiscussionItem!]!
    activeDiscussion: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Consultation {
    id: ID!
    studentName: String!
    program: CourseTaken!
    level: String!
    status: ConsultStage!
    studyStage: StudyStage!
    methodology: Methodology
    consultMembers: [User!]! # Add ! to indicate non-null array items
    createdBy: User! # Add ! to indicate non-null
    invoices: [Invoice]!
    uploads: [Upload]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    getConsultation(id: ID!): Consultation
    getConsultations(id: ID!): [Consultation]!
  }

  input InvoiceInput {
    amount: Float!
    status: InvoiceStatus!
    dueDate: DateTime!
  }

  input UploadInput {
    id: ID!
    url: String!
    discussion: [DiscussionItemInput]!
    description: String!
    activeDiscussion: String
  }

  input CreateConsultationInput {
    studentName: String!
    createdBy: ID!
    program: CourseTaken!
    level: String
    studyStage: StudyStage!
    status: ConsultStage!
    methodology: Methodology
    invoices: [InvoiceInput]
    uploads: [UploadInput]
  }

  input AdminUpdateInput {
    studentName: String
    program: CourseTaken
    level: String
    studyStage: StudyStage
    methodology: Methodology
    consultMembers: [ID]
    invoices: [InvoiceInput]
    uploads: [UploadInput]
  }

  type MigrationResult {
    message: String!
    migratedCount: Int!
  }
  input DiscussionItemInput {
    consultationId: String!
    uploadId: String!
    page: Int
    text: String!
    x: Float
    y: Float
    width: Float
    height: Float
    author: String!
    timestamp: DateTime!
  }

  type Mutation {
    createConsultation(input: CreateConsultationInput!): Consultation!
    updateConsultation(id: ID!, studyStage: StudyStage): Consultation!
    migrateDiscussions: MigrationResult
    deleteConsultation(id: ID!): Boolean!
    deleteAllConsultations: Boolean!
    addConsultationDiscussion(
      discussionItem: DiscussionItemInput!
    ): Consultation
    adminUpdateConsultation(id: ID!, studyStage: StudyStage!): Consultation!
    tutorUpdateStudyStage(id: ID!, studyStage: StudyStage!): Consultation!
  }
`;

export default consultationTypeDefs;
