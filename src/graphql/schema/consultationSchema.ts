import { gql } from "graphql-tag";

export const consultationTypeDefs = gql`
  scalar DateTime

  # ============================================
  # ENUMS
  # ============================================

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

  # ============================================
  # CORE STRUCTURES
  # ============================================

  type ConsultationRect {
    x: Float!
    y: Float!
    width: Float!
    height: Float!
  }

  type Author {
    id: ID!
    name: String!
    email: String!
    color: String!
  }

  # ============================================
  # REVIEWER COMMENTS (RENAMED FROM PaperAnnotation)
  # ============================================

  type ReviewerComment {
    id: ID!
    page: Int!
    rect: ConsultationRect!
    text: String!
    author: Author!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  # ============================================
  # LIVE SESSION
  # ============================================

  type LiveSession {
    isActive: Boolean!
    currentPage: Int
    activeReviewerCommentId: String
  }

  # ============================================
  # INVOICES
  # ============================================

  type Invoice {
    amount: Float!
    status: InvoiceStatus!
    dueDate: DateTime!
    issuedAt: DateTime!
  }

  # ============================================
  # MAIN CONSULTATION
  # ============================================

  type Consultation {
    id: ID!
    title: String!
    studentName: String!

    program: CourseTaken!
    level: String

    studyStage: StudyStage!
    methodology: Methodology
    status: ConsultStage!

    sessionId: String!
    url: String

    createdBy: User!

    externalParticipants: [Author!]!

    reviewerComments: [ReviewerComment!]!
    annotationCount: Int!

    liveSession: LiveSession

    invoices: [Invoice!]!

    createdAt: DateTime!
    updatedAt: DateTime
  }

  # =========================
  # CORE TYPE
  # =========================

  # =========================
  # INPUTS
  # =========================

  input RegisterConsultSessionInput {
    sessionId: String!
    email: String!
  }
  # ============================================
  # INPUTS
  # ============================================

  input ConsultationRectInput {
    x: Float!
    y: Float!
    width: Float!
    height: Float!
  }

  input AuthorInput {
    id: ID!
    name: String!
    email: String!
    color: String!
  }

  input ReviewerCommentInput {
    page: Int!
    rect: ConsultationRectInput!
    text: String!
    author: AuthorInput!
  }

  input InvoiceInput {
    amount: Float!
    status: InvoiceStatus!
    dueDate: DateTime!
  }

  input CreateConsultationInput {
    title: String!
    studentName: String!
    createdBy: ID!

    program: CourseTaken!
    level: String

    studyStage: StudyStage!
    status: ConsultStage!
    methodology: Methodology

    sessionId: String!
    url: String

    externalParticipants: [AuthorInput!]
    invoices: [InvoiceInput!]
  }

  input UpdateConsultationInput {
    title: String
    studentName: String
    program: CourseTaken
    level: String
    studyStage: StudyStage
    methodology: Methodology
    status: ConsultStage
    url: String
    externalParticipants: [AuthorInput!]
  }

  # ============================================
  # QUERIES
  # ============================================

  type Query {
    getConsultationBySessionId(sessionId: String!): Consultation

    getConsultation(id: ID!): Consultation
    getConsultations: [Consultation!]!
  }
  # ============================================
  # MUTATIONS
  # ============================================

  type Mutation {
    createConsultation(input: CreateConsultationInput!): Consultation!

    updateConsultation(id: ID!, input: UpdateConsultationInput!): Consultation!

    deleteConsultation(id: ID!): Boolean!
    # register user/session into consultation flow
    registerForConsultingSession(
      input: RegisterConsultSessionInput!
    ): Consultation!
    # Reviewer comment actions
    addReviewerComment(
      consultationId: ID!
      input: ReviewerCommentInput!
    ): ReviewerComment!

    updateReviewerComment(
      consultationId: ID!
      reviewerCommentId: ID!
      input: ReviewerCommentInput!
    ): ReviewerComment!

    deleteReviewerComment(consultationId: ID!, reviewerCommentId: ID!): Boolean!
  }
`;

export default consultationTypeDefs;
