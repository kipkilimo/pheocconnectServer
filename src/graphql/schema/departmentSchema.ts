import { gql } from "graphql-tag";

// Import User type from the user type definitions
import userTypeDefs from "./userSchema"; // Adjust the import path as necessary

// Define the GraphQL types and operations for Department
export const departmentTypeDefs = gql`
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
    id: ID!
    createdBy: User!
    name: String!
    certificate: String!
    duration: String!
    requiredCredits: Int!
    coursesOffered: [String!]!
    payments: String!
  }

  type Department {
    id: ID
    createdBy: User!
    departmentId: String
    name: String
    parent_institution: String
    phone_number: String
    email_address: String
    faculty: [User] # Using imported User type for faculty
    programs: String
    students: [User] # Using imported User type for students
  }

  type Query {
    getDepartment(departmentId: ID!): Department
    getDepartments: [Department]
  }

  type Mutation {
    createADepartment(
      departmentId: String
      name: String!
      parent_institution: String
      phone_number: String
      email_address: String
      createdBy: ID!
      members: [String!]!
    ): Department
    updateDepartment(
      departmentId: String
      name: String!
      parent_institution: String
      phone_number: String
      email_address: String
      membershipUpdate: String!
      members: [String!]!
    ): Department
    deleteDepartment(departmentId: ID!): Department
  }
`;

export default departmentTypeDefs;
