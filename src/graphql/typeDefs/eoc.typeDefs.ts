import { gql } from "graphql-tag";

export const eocTypeDefs = gql`
  type EOC {
    id: ID!
    name: String!
    level: OperationalLevel!
    country: String
    county: String
    subCounty: String

    # ============================================
    # HIERARCHY (IMS STRUCTURE)
    # ============================================

    parentId: ID
    parent: EOC
    children: [EOC]

    # ============================================
    # ORGANIZATION
    # ============================================

    organizationId: ID
    organization: Organization

    # ============================================
    # OPERATIONAL CONTEXT
    # ============================================

    alertLevel: AlertLevel!
    activeIncidents: [Incident]
    totalIncidents: Int!

    # ============================================
    # GIS CORE (IMPORTANT ADDITION)
    # ============================================

    location: GeoPoint
    bbox: GeoPolygon
    centroid: GeoCoordinate

    # ============================================
    # METADATA
    # ============================================

    createdAt: DateTime!
    updatedAt: DateTime
  }

  # ============================================
  # GIS SCALARS / TYPES
  # ============================================

  type GeoPoint {
    type: String!
    coordinates: [Float!]! # [lng, lat]
  }

  type GeoPolygon {
    type: String!
    coordinates: [[[Float!]!]!]!
  }

  type GeoCoordinate {
    lat: Float!
    lng: Float!
  }

  # ============================================
  # QUERIES
  # ============================================

  extend type Query {
    eocs: [EOC!]!
    eoc(id: ID!): EOC

    rootEOCs: [EOC!]!
    childEOCs(parentId: ID!): [EOC!]!
    peerEOCs(id: ID!): [EOC!]!

    # ============================================
    # GIS QUERIES (NEW)
    # ============================================

    eocsNear(
      lng: Float!
      lat: Float!
      radiusKm: Float!
    ): [EOC!]!

    eocsInCounty(county: String!): [EOC!]!
  }

  # ============================================
  # MUTATIONS
  # ============================================

  extend type Mutation {
    createEOC(
      name: String!
      level: OperationalLevel!
      parentId: ID
      organizationId: ID
      country: String
      county: String
      subCounty: String

      # GIS INPUTS
      lng: Float
      lat: Float
      bbox: [[[Float!]]]
    ): EOC!

    updateEOCLevel(
      id: ID!
      level: OperationalLevel!
    ): EOC!
  }
`;