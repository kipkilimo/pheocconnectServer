import { gql } from "graphql-tag";

export const labTypeDefs = gql`
  type LabResult {
    id: ID!
    caseId: ID!
    testType: String!
    result: String!
    confirmed: Boolean!
    reportedAt: DateTime!
  }

  # ============================================
  # INPUTS
  # ============================================

  input AddLabResultInput {
    caseId: ID!
    testType: String!
    result: String!
  }

  # ============================================
  # QUERIES
  # ============================================

  extend type Query {
    # Get all lab results for a case
    labResults(caseId: ID!): [LabResult!]! @auth

    # Optional single result (useful for audit / traceability)
    labResult(id: ID!): LabResult @auth
  }

  # ============================================
  # MUTATIONS
  # ============================================

  extend type Mutation {
    # Add new lab result
    addLabResult(input: AddLabResultInput!): LabResult! @auth

    # Mark result as confirmed (useful for surveillance pipeline)
    confirmLabResult(id: ID!): LabResult! @auth
  }
`;
