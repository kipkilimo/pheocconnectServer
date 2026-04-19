import { gql } from "graphql-tag";

export const surveillanceTypeDefs = gql`
  type Disease {
    id: ID!
    name: String!
    category: String
    notifiable: Boolean!
  }

  type Case {
    id: ID!
    incidentId: ID!
    classification: CaseClassification!
    patientAge: Int
    patientSex: String
    location: String
    reportedAt: DateTime!
  }

  extend type Query {
    cases(incidentId: ID!): [Case!]!
  }

  extend type Mutation {
    addCase(
      incidentId: ID!
      classification: CaseClassification!
    ): Case!
  }
`;