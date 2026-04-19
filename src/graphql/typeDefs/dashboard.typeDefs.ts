import { gql } from "graphql-tag";

export const dashboardTypeDefs = gql`
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
  # QUERIES
  # ============================================

  extend type Query {
    dashboardStats(
      eocId: ID
      county: String
      organizationId: ID
    ): DashboardStats! @auth
  }
`;