import { gql } from "graphql-tag";

export const incidentTypeDefs = gql`
  enum IncidentStatus {
    ACTIVE
    RESOLVED
    INVESTIGATING
    MONITORING
    CLOSED
  }

  enum AlertLevel {
    LOW
    MODERATE
    HIGH
    CRITICAL
  }

  scalar DateTime

  type Incident {
    id: ID!
    title: String!
    diseaseId: ID
    eocId: ID!
    status: IncidentStatus!
    alertLevel: AlertLevel!
    cases: Int
    deaths: Int
    location: String!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  input ReportIncidentInput {
    title: String!
    diseaseId: ID
    eocId: ID!
    location: String!
    alertLevel: AlertLevel!
    cases: Int
    deaths: Int
  }

  input IncidentsFilterInput {
    status: IncidentStatus
    alertLevel: AlertLevel
    diseaseId: ID
    eocId: ID
  }

  extend type Query {
    incidents(
      filter: IncidentsFilterInput
      limit: Int
      offset: Int
    ): [Incident!]!
    incident(id: ID!): Incident
  }

  extend type Mutation {
    reportIncident(input: ReportIncidentInput!): Incident!
    updateIncidentStatus(id: ID!, status: IncidentStatus!): Incident!
  }
`;
