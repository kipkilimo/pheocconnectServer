import { gql } from "graphql-tag";

export const dashboardTypeDefs = gql`
  # Ensure Role enum is defined (if not already in another typeDef)
  enum Role {
    ADMIN
    EOC_MANAGER
    USER
  }

  type DashboardStats {
    # ============================================
    # CORE SURVEILLANCE METRICS
    # ============================================

    totalIncidents: Int!
    activeIncidents: Int!
    closedIncidents: Int

    totalCases: Int!
    suspectedCases: Int
    confirmedCases: Int

    totalDeaths: Int

    # ============================================
    # LAB + RESPONSE PIPELINE
    # ============================================

    pendingLabResults: Int
    confirmedLabResults: Int

    responseActionsPending: Int
    responseActionsCompleted: Int

    # ============================================
    # LOGISTICS / RESOURCES
    # ============================================

    resourcesDeployed: Int
    activeDeployments: Int

    # ============================================
    # EOC / OPERATIONAL LAYER (IMPORTANT FOR GIS UI)
    # ============================================

    activeEOCs: Int
    escalatedEOCs: Int
    standbyEOCs: Int

    # ============================================
    # SYSTEM HEALTH (FOR ADMIN PANEL)
    # ============================================

    systemStatus: String
    lastUpdated: DateTime!
  }

  # ============================================
  # RECENT ITEMS TYPES
  # ============================================

  type RecentIncident {
    id: ID!
    title: String
    status: String
    severity: String
    reportedAt: DateTime!
    location: String
  }

  type RecentCase {
    id: ID!
    caseId: String
    status: String
    type: String
    reportedAt: DateTime!
    patientName: String
  }

  type RecentLabResult {
    id: ID!
    sampleId: String
    result: String
    testedAt: DateTime!
    status: String
  }

  type RecentResponseAction {
    id: ID!
    actionType: String
    status: String
    assignedTo: String
    createdAt: DateTime!
  }

  type RecentDeployment {
    id: ID!
    resourceType: String
    quantity: Int
    destination: String
    deployedAt: DateTime!
  }

  type RecentItems {
    incidents: [RecentIncident!]!
    cases: [RecentCase!]!
    labResults: [RecentLabResult!]!
    responseActions: [RecentResponseAction!]!
    deployments: [RecentDeployment!]!
  }

  # ============================================
  # QUERIES - Allow both ADMIN and EOC_MANAGER
  # ============================================

  extend type Query {
    dashboardStats(
      eocId: ID
      county: String
      organizationId: ID
    ): DashboardStats! @auth(requires: [ADMIN, EOC_MANAGER])

    recentItems(
      eocId: ID
      county: String
      organizationId: ID
      limit: Int = 10
    ): RecentItems! @auth(requires: [ADMIN, EOC_MANAGER])
  }
`;
