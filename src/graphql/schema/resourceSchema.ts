import { gql } from "apollo-server-express";

// Define the GraphQL types
export const resourceTypeDefs = gql`
  enum ResourceType {
    AUDIO
    VIDEO
    IMAGES
    DOCUMENT
    MIXED
    TEXT
    PRESENTATION
    EVENT
    DATASET
    LINK
    POLL
    TEST
    POSTER
    MODEL
    ARTICLE
    OPPORTUNITY
    TASK
    COMPUTING
  }

  type Resource {
    id: ID!
    title: String!
    description: String
    content: String!
    metaInfo: String
    targetRegion: String
    targetCountry: String
    slug: String
    language: String
    contentType: ResourceType!
    viewsNumber: Int
    likesNumber: Int
    sharesNumber: Int
    subject: String!
    topic: String!
    rating: String
    questions: String
    sessionId: String!
    accessKey: String!
    keywords: String
    participants: String
    coverImage: String
    isPublished: Boolean
    averageRating: Float
    reviews: String
    createdBy: User!
    createdAt: String
    updatedAt: String
  }

  type User {
    id: ID!
    name: String!
    email: String!
    # Other fields
  }
  type ResourceSummary {
    audioCount: Int
    videoCount: Int
    imagesCount: Int
    documentCount: Int
    presentationCount: Int
    eventCount: Int
    datasetCount: Int
    linkCount: Int
    pollCount: Int
    testCount: Int
    modelCount: Int
    posterCount: Int
    articleCount: Int
    jobCount: Int
    taskCount: Int
    mostLikedResource: ResourceDetail
    mostRequestedResource: ResourceDetail
    mostCreatedResource: ResourceDetail
    publicationTrends: [PublicationTrend]
  }

  type ResourceDetail {
    title: String
    likesNumber: Int
    viewsNumber: Int
    createdAt: String
  }

  type PublicationTrend {
    month: Int
    count: Int
  }
  type ExamMetaInfo {
    id: ID!
    title: String
    coverImage: String
    description: String
    examMetaInfo: ExamMetaDetails
    subject: String
    topic: String
    createdBy: User
    createdAt: String
    sessionId: String
    accessKey: String
    participants: String
  }

  type ExamMetaDetails {
    examDate: String
    examStartTime: String
    examQuestionsSet: [String]
    examAnswersKey: [String]
    examDuration: String
    examEndTime: String
    selectedTypes: [String]
    numberOfQuestions: QuestionCount
    markingSchemes: MarkingScheme
    testMeta: [TestMeta]
  }

  type QuestionCount {
    SCQ: String
    MCQ: String
    ATF: String
    ETF: String
    VSAQ: String
    SAQ: String
    LEQ: String
  }

  type MarkingScheme {
    SCQ: String
    MCQ: String
    ATF: String
    ETF: String
  }

  type TestMeta {
    testType: String
    numberOfQuestions: String
  }

  # AssignmentMetaInfo type for capturing the metadata of the assignment
  type AssignmentMetaInfo {
    assignmentType: String
    assignmentTitle: String
    assignmentDescription: String
    assignmentDuration: String
    assignmentDeadline: String
    assignmentAnswersKey: [String] # Array of strings for answer keys
    assignmentTaskSet: [String] # Array of strings for task set
    id: ID! # Unique ID for the assignment
    title: String # Title of the assignment
    coverImage: String # Cover image URL of the assignment
    description: String # Description of the assignment
    subject: String # Subject area of the assignment
    topic: String # Topic of the assignment
    createdBy: User # Information about the user who created the assignment
    createdAt: String # Timestamp of when the assignment was created
    sessionId: String # Session ID related to the assignment
    accessKey: String # Access key for the assignment
    participants: String # Participant information
  }

  type Query {
    getAllTopicResourcesByTopic(resourceTitle: String, userId: ID): [Resource]!
    getTutorplexResources(resourceTitle: String, userId: String): [Resource!]!
    getAllSearchResults(searchQuery: String, userId: String): [Resource!]!
    getPublisherLatestExams(userId: String!): [ExamMetaInfo]
    getCurrentExam(sessionId: String!, examType: String): ExamMetaInfo
    getAllMockExams(resourceType: String!): [ExamMetaInfo]

    getPublisherLatestTasks(userId: String!): [AssignmentMetaInfo]
    fetchResourceSummaryByRoleAndType: [ResourceSummary!]!

    getResource(id: ID!): Resource
    getLIVEResource(accessKey: String!): Resource
    fetchComputingResource(topicParams: String!): Resource
    getAllTaskResources: [Resource!]!
    getQuestions(resourceId: ID!): String
    getAllResources: [Resource!]!
    getAllSpecificTypeResources(resourceType: String!): [Resource!]!
    getUserTasks(userId: String!): [Resource!]!

    getPublisherLatestPoll(userId: String!): Resource
    getAllRecentNewsArticles: [Resource!]!
    # suggested getSuggestedResources(userId: string)

    getRecentResources(userId: String!): [Resource]
    getLibraryResources(userId: String!): [Resource]
    getSuggestedResources(userId: String!): [Resource]

    getResources(
      subject: String
      topic: String
      title: String
      contentType: ResourceType
      targetRegion: String
      language: String
    ): [Resource]
  }

  type Mutation {
    createResource(
      title: String!
      description: String!
      subject: String!
      topic: String!
      targetRegion: String
      targetCountry: String
      language: String
      contentType: ResourceType!
      keywords: String
      createdBy: ID!
    ): Resource

    togglePublicationStatus(
      resourceStatus: String!
      resourceId: String!
    ): Resource!
    addResourceFormContent(resourceDetails: String!): Resource!

    updateResource(
      id: ID!
      title: String
      description: String
      content: String
      targetRegion: String
      targetCountry: String
      slug: String
      language: String
      contentType: ResourceType
      viewsNumber: Int
      likesNumber: Int
      sharesNumber: Int
      rating: String
      subject: String
      topic: String
      sessionId: String
      accessKey: String
      keywords: String
      coverImage: String
      isPublished: Boolean
      averageRating: Float
      reviews: String
    ): Resource

    deleteResource(id: ID!): Resource
  }
`;

export default resourceTypeDefs;
