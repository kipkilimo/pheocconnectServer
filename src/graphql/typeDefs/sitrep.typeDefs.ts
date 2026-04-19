import { gql } from "graphql-tag";

export const sitrepTypeDefs = gql`
  type SitRep {
    id: ID!
    incidentId: ID!
    summary: String!
    actions: String
    recommendations: String
    createdBy: ID
    approvedBy: ID
    createdAt: DateTime!
  }

  input CreateSitRepInput {
    incidentId: ID!
    summary: String!
    actions: String
    recommendations: String
  }

  extend type Query {
    sitreps(incidentId: ID!): [SitRep!]!
  }

  extend type Mutation {
    createSitRep(input: CreateSitRepInput!): SitRep!
    approveSitRep(id: ID!, userId: ID!): SitRep!
  }
`;