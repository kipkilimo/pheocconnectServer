import { gql } from "apollo-server-express";

export const questionTypeDefs = gql`
  enum DifficultyLevel {
    EASY
    MEDIUM
    HARD
  }

  enum QuestionSpecialty {
    EPIDEMIOLOGY
    BIOSTATISTICS
    RESEARCH_METHODS
  }

  enum QuestionType {
    QUICK_TRUE_FALSE
    EXPANDED_TRUE_FALSE
    SINGLE_SELECT
    MULTI_SELECT
    VERY_SHORT_ANSWER
    SHORT_ANSWER
    LONG_ANSWER
  }

  enum AnswerAccuracy {
    CORRECT
    PARTIALLY_CORRECT
    INCORRECT
    MANUAL_REVIEW_NEEDED
  }

  type OpenEndedAnswer {
    submittedAnswer: String!
    accuracy: AnswerAccuracy!
    feedback: String
    reviewerId: ID
    reviewedAt: String
    createdAt: String!
  }

  type QuestionMetrics {
    timesAttempted: Int!
    timesCorrect: Int!
    timesPartiallyCorrect: Int!
    timesIncorrect: Int!
    averageTimeSeconds: Float
    lastAnsweredAt: String
    openEndedAnswers: [OpenEndedAnswer!]
    confidenceScore: Float
  }

  type Question {
    id: ID!
    shortId: String!
    stem: String!
    choices: [String!]!
    correctAnswers: [String]
    explanation: String
    tags: [String!]
    specialty: QuestionSpecialty!
    topic: [String]
    difficulty: DifficultyLevel!
    questionType: QuestionType!
    createdAt: String!
    updatedAt: String!
    metrics: QuestionMetrics
  }

  type RevisionQuiz {
    questionType: [QuestionType!]!
    questions: [Question!]!
  }

  type BulkQuestionError {
    index: Int!
    message: String!
    questionData: String
  }

  type BulkQuestionResult {
    successCount: Int!
    failCount: Int!
    questions: [Question!]!
    errors: [BulkQuestionError!]!
  }

  type QuestionAnswerResult {
    question: Question!
    isCorrect: Boolean
    accuracy: AnswerAccuracy
  }

  input OpenEndedAnswerInput {
    submittedAnswer: String!
    confidence: Float
    isComplete: Boolean
  }

  input QuestionInput {
    stem: String!
    choices: [String]
    correctAnswers: [String]
    explanation: String
    tags: [String]
    specialty: QuestionSpecialty!
    topic: [String]!
    difficulty: DifficultyLevel!
    questionType: QuestionType!
  }

  input QuestionAnswerInput {
    questionId: ID!
    selectedAnswers: [String!]
    openEndedAnswer: OpenEndedAnswerInput
    timeSeconds: Float!
  }

  input BulkQuestionsInput {
    questionsJson: String!
    questionType: QuestionType!
  }

  input QuestionTypeCounts {
    QUICK_TRUE_FALSE: Int
    EXPANDED_TRUE_FALSE: Int
    SINGLE_SELECT: Int
    MULTI_SELECT: Int
    VERY_SHORT_ANSWER: Int
    SHORT_ANSWER: Int
    LONG_ANSWER: Int
  }

  input QuizFilterInput {
    userId: String!
    specialty: QuestionSpecialty!
    topic: [String]
    difficulty: [DifficultyLevel]
    questionType: [QuestionType] # Kept for backward compatibility
    questionTypeCounts: QuestionTypeCounts # New field for advanced filtering
    limit: Int = 250
  }

  input ReviewAnswerInput {
    questionId: ID!
    answerIndex: Int!
    accuracy: AnswerAccuracy!
    feedback: String
  }

  input RevisionBuilderInput {
    userId: ID!
    topic: [String]
    revisionType: String!
    questionTypeDetails: String!
    count: Int!
  }

  type Query {
    getQuestionByShortId(shortId: String!): Question
    getCurrentQuizzes(filter: QuizFilterInput!): [Question!]!

    #NEMBIOTEST,DGTEST,SDLTEST,EXAMTEST
    revisionBuilder(quizSelections: [RevisionBuilderInput!]!): [RevisionQuiz!]!

    getUnreviewedOpenEndedAnswers(
      specialty: QuestionSpecialty
      limit: Int = 50
    ): [Question!]!

    getMostMissedQuestions(limit: Int = 10): [Question!]!
  }

  type Mutation {
    createQuestion(input: QuestionInput!): Question!
    createBulkQuestions(input: BulkQuestionsInput!): BulkQuestionResult!
    submitQuestionAnswer(input: QuestionAnswerInput!): QuestionAnswerResult!
    reviewOpenEndedAnswer(input: ReviewAnswerInput!): Question!
  }
`;

export default questionTypeDefs;
