import { gql } from "graphql-tag";

export const organizationTypeDefs = gql`
  type Organization {
    id: ID!
    name: String!
    type: OrganizationType!
    country: String
    users: [User]
  }

  # ============================================
  # INPUTS
  # ============================================

  input CreateOrganizationInput {
    name: String!
    type: OrganizationType!
    country: String
  }

  input UpdateOrganizationInput {
    name: String
    type: OrganizationType
    country: String
  }

  # ============================================
  # QUERIES
  # ============================================

  extend type Query {
    # Get all organizations
    organizations: [Organization!]! @auth

    # Get single organization
    organization(id: ID!): Organization @auth

    # Filter by type (e.g. NGOs only)
    organizationsByType(type: OrganizationType!): [Organization!]! @auth

    # Current user's organization
    myOrganization: Organization @auth
  }

  # ============================================
  # MUTATIONS
  # ============================================

  extend type Mutation {
    # Create new organization
    createOrganization(
      input: CreateOrganizationInput!
    ): Organization! @auth(requires: [ADMIN])

    # Update organization details
    updateOrganization(
      id: ID!
      input: UpdateOrganizationInput!
    ): Organization! @auth(requires: [ADMIN])

    # Delete organization (soft delete recommended)
    deleteOrganization(
      id: ID!
    ): Boolean! @auth(requires: [ADMIN])
  }
`;