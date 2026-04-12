import { gql } from "apollo-server-express";

// Define the GraphQL types and operations for Vendor
export const vendorTypeDefs = gql`
  type Vendor {
    id: ID!
    vendorId: String!
    vendorPin: String!
  }

  type Query {
    getVendor(id: ID!): Vendor
    getVendors: [Vendor!]!
  }

  type Mutation {
    createVendor(vendorId: String!, vendorPin: String!): Vendor
    updateVendor(id: ID!, vendorId: String, vendorPin: String): Vendor
    deleteVendor(id: ID!): Vendor
  }
`;

export default vendorTypeDefs;
