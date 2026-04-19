import { gql } from "graphql-tag";

export const incidentTypeDefs = gql`
  type Incident {
    id: ID!
    title: String!
    diseaseId: ID
    eocId: ID!
    status: IncidentStatus!
    alertLevel: AlertLevel!
    cases: Int
    deaths: Int
    createdAt: DateTime!
    updatedAt: DateTime
  }

  input ReportIncidentInput {
    title: String!
    diseaseId: ID
    eocId: ID!
  }

  extend type Query {
    incidents(status: IncidentStatus): [Incident!]!
    incident(id: ID!): Incident
  }

  extend type Mutation {
    reportIncident(input: ReportIncidentInput!): Incident!
    updateIncidentStatus(id: ID!, status: IncidentStatus!): Incident!
  }
`;