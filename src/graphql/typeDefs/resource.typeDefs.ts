import { gql } from "graphql-tag";

export const resourceTypeDefs = gql`
  type Resource {
    id: ID!
    name: String!
    type: ResourceType!
    quantity: Int!
    location: String
  }

  type Deployment {
    id: ID!
    resourceId: ID!
    incidentId: ID!
    deployedTo: String!
    deployedAt: DateTime!
    returnedAt: DateTime
  }

  extend type Query {
    resources: [Resource!]!
    deployments(incidentId: ID!): [Deployment!]!
  }

  extend type Mutation {
    deployResource(
      resourceId: ID!
      incidentId: ID!
      deployedTo: String!
    ): Deployment!
  }
`;