import { gql } from "graphql-tag";

export const surveillanceTypeDefs = gql`
  enum CaseClassification {
    SUSPECTED
    PROBABLE
    CONFIRMED
    NOT_A_CASE
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum AlertStatus {
    NEW
    ACKNOWLEDGED
    INVESTIGATING
    RESOLVED
    FALSE_ALARM
  }

  enum PatientSex {
    MALE
    FEMALE
    OTHER
    UNKNOWN
  }

  enum CaseOutcome {
    RECOVERED
    HOSPITALIZED
    DECEASED
    UNDER_TREATMENT
    LOST_TO_FOLLOWUP
  }

  type Disease {
    id: ID!
    name: String!
    category: String
    notifiable: Boolean!
    symptoms: [String!]
    incubationPeriod: Int
    createdAt: DateTime!
    updatedAt: DateTime
  }

  type Case {
    id: ID!
    incidentId: ID!
    classification: CaseClassification!
    patientAge: Int
    patientSex: PatientSex
    location: String
    symptoms: [String!]
    outcome: CaseOutcome
    reportedAt: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  type SurveillanceAlert {
    id: ID!
    title: String!
    description: String
    severity: AlertSeverity!
    status: AlertStatus!
    location: String
    diseaseId: ID
    triggeredBy: ID
    detectedAt: DateTime!
    resolvedAt: DateTime
    acknowledgedAt: DateTime
    incidentId: ID
    createdAt: DateTime!
    updatedAt: DateTime
  }

  input AddCaseInput {
    incidentId: ID!
    classification: CaseClassification!
    patientAge: Int
    patientSex: PatientSex
    location: String
    symptoms: [String!]
    outcome: CaseOutcome
  }

  input DiseasesFilterInput {
    category: String
    notifiable: Boolean
    search: String
  }

  input SurveillanceAlertsFilterInput {
    severity: AlertSeverity
    status: AlertStatus
    diseaseId: ID
    incidentId: ID
    fromDate: DateTime
    toDate: DateTime
  }

  input UpdateCaseInput {
    classification: CaseClassification
    patientAge: Int
    patientSex: PatientSex
    location: String
    symptoms: [String!]
    outcome: CaseOutcome
  }

  input CreateDiseaseInput {
    name: String!
    category: String
    notifiable: Boolean!
    symptoms: [String!]
    incubationPeriod: Int
  }

  input UpdateDiseaseInput {
    name: String
    category: String
    notifiable: Boolean
    symptoms: [String!]
    incubationPeriod: Int
  }

  input CreateAlertInput {
    title: String!
    description: String
    severity: AlertSeverity!
    location: String
    diseaseId: ID
    triggeredBy: ID
  }

  type AlertSeverityCount {
    LOW: Int!
    MEDIUM: Int!
    HIGH: Int!
    CRITICAL: Int!
  }

  type CaseClassificationBreakdown {
    SUSPECTED: Int!
    PROBABLE: Int!
    CONFIRMED: Int!
    NOT_A_CASE: Int!
  }

  type SurveillanceSummary {
    incidentId: ID!
    totalCases: Int!
    confirmedCases: Int!
    probableCases: Int!
    suspectedCases: Int!
    deaths: Int!
    recovered: Int!
    activeCases: Int!
    alertsBySeverity: AlertSeverityCount!
    recentAlerts: [SurveillanceAlert!]!
    caseClassificationBreakdown: CaseClassificationBreakdown!
  }

  extend type Query {
    diseases(filter: DiseasesFilterInput, limit: Int, offset: Int): [Disease!]!
    disease(id: ID!): Disease
    cases(
      incidentId: ID!
      classification: CaseClassification
      limit: Int
      offset: Int
    ): [Case!]!
    case(id: ID!): Case
    surveillanceAlerts(
      filter: SurveillanceAlertsFilterInput
      limit: Int
      offset: Int
    ): [SurveillanceAlert!]!
    surveillanceAlert(id: ID!): SurveillanceAlert
    surveillanceSummary(incidentId: ID!): SurveillanceSummary!
  }

  extend type Mutation {
    addCase(input: AddCaseInput!): Case!
    updateCase(id: ID!, input: UpdateCaseInput!): Case!
    deleteCase(id: ID!): Boolean!
    createDisease(input: CreateDiseaseInput!): Disease!
    updateDisease(id: ID!, input: UpdateDiseaseInput!): Disease!
    createSurveillanceAlert(input: CreateAlertInput!): SurveillanceAlert!
    acknowledgeAlert(id: ID!): SurveillanceAlert!
    resolveAlert(id: ID!): SurveillanceAlert!
    linkAlertToIncident(alertId: ID!, incidentId: ID!): SurveillanceAlert!
  }
`;
