import { gql } from "graphql-tag";

// Import User type from the user type definitions
import userTypeDefs from "./userSchema"; // Adjust the import path as necessary

// Define the GraphQL types and operations for DiscussionGroup
export const DiscussionGroupTypeDefs = gql`
  # Include the user type definitions
  ${userTypeDefs}

  type Course {
    courseId: ID!
    courseName: String!
    courseCode: String!
    credits: Int!
  }

  type Payment {
    paymentId: ID!
    paymentDate: String!
    paymentCode: String!
    amount: Int!
  }

  type Program {
    programId: ID!
    name: String!
    degree: String!
    duration: String!
    requiredCredits: Int!
    coursesOffered: [String!]!
    payments: String
  }

  type DiscussionGroup {
    id: ID
    discussionGroupId: String
    name: String
    members: [User]
    program: String
  }

  type Query {
    getDiscussionGroup(discussionGroupId: ID!): DiscussionGroup
    getDiscussionGroups: [DiscussionGroup]
  }

  type Mutation {
    createDiscussionGroup(
      discussionGroupId: String # Discussion group identifier
      name: String! # Name of the discussion group
      program: String! # Program associated with the group
      createdBy: ID! # ID of the user creating the group
      members: [String!]! # List of member emails
    ): DiscussionGroup # Returns the created DiscussionGroup
    updateDiscussionGroup(
      discussionGroupId: String!
      name: String
      program: String
      members: [String!]!
    ): DiscussionGroup # Returns the updated DiscussionGroup
    deleteDiscussionGroup(
      discussionGroupId: ID! # Unique ID for the discussion group to delete
    ): DiscussionGroup # Returns the deleted DiscussionGroup
  }
`;

export default DiscussionGroupTypeDefs;
