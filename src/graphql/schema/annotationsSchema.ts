import { gql } from "apollo-server-express";

export const annotationTypeDefs = gql`
  # ============================================
  # ANNOTATION INPUTS
  # ============================================

  input CreateAnnotationInput {
    paperId: ID!
    page: Int!
    x: Float!
    y: Float!
    width: Float!
    height: Float!
    title: String
    text: String!
  }

  input UpdateAnnotationInput {
    id: ID!
    text: String!
    title: String
  }

  input AddReactionInput {
    annotationId: ID!
    type: String!
    text: String
  }

  # ============================================
  # ANNOTATION QUERIES
  # ============================================

  extend type Query {
    getPaperAnnotations(
      paperId: ID!
      page: Int
      limit: Int
    ): [PaperAnnotation!]!
    getMyPaperAnnotations: [PaperAnnotation!]!
  }

  # ============================================
  # ANNOTATION MUTATIONS
  # ============================================

  extend type Mutation {
    createPaperAnnotation(input: CreateAnnotationInput!): PaperAnnotation!
    updatePaperAnnotation(input: UpdateAnnotationInput!): PaperAnnotation!
    deletePaperAnnotation(id: ID!): Boolean!
    addPaperReaction(input: AddReactionInput!): PaperReaction!
    removePaperReaction(id: ID!): Boolean!
  }
`;

export default annotationTypeDefs;
