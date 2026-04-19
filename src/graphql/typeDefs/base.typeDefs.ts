import { gql } from "graphql-tag";

export const baseTypeDefs = gql`
  scalar DateTime

  directive @auth(
    requires: [Role!] = [ADMIN]
  ) on FIELD_DEFINITION

  enum Role {
    ADMIN
    EOC_MANAGER
    SURVEILLANCE_OFFICER
    LAB_OFFICER
    FIELD_OFFICER
    LOGISTICS
    ANALYST
    PARTNER
    PUBLIC_VIEWER
  }

  enum IncidentStatus {
    REPORTED
    VERIFIED
    CONFIRMED
    RESPONDING
    CONTROLLED
    CLOSED
  }

  enum AlertLevel {
    NORMAL
    STANDBY
    ACTIVATED
    ESCALATED
    DEACTIVATED
  }

  enum CaseClassification {
    SUSPECTED
    PROBABLE
    CONFIRMED
    DISCARDED
  }

  enum ResourceType {
    HUMAN
    MEDICAL
    TRANSPORT
    SUPPLY
  }

  enum OrganizationType {
    GOVERNMENT
    NGO
    INTERNATIONAL
    PRIVATE
  }

  enum OperationalLevel {
    NATIONAL
    COUNTY
    SUBCOUNTY
    WARD
  }
`;