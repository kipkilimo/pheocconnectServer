import { gql } from "graphql-tag";

export const responseTypeDefs = gql`
  type ResponseAction {
    id: ID!
    incidentId: ID!
    pillar: String!
    description: String!
    status: String!
    assignedTo: ID
    dueDate: DateTime
  }

  extend type Mutation {
    addResponseAction(
      incidentId: ID!
      pillar: String!
      description: String!
    ): ResponseAction!
  }
`;