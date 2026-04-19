import { gql } from "graphql-tag";

/**
 * --------------------------------------------------
 * ROOT TYPES (must exist for extend type to work)
 * --------------------------------------------------
 */
export const rootTypeDefs = gql`
  scalar DateTime

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Subscription {
    _empty: String
  }
`;

/**
 * --------------------------------------------------
 * IMPORT ALL MODULE TYPEDEFS
 * --------------------------------------------------
 */
import { baseTypeDefs } from "./base.typeDefs";
import { userTypeDefs } from "./user.typeDefs";
import { organizationTypeDefs } from "./organization.typeDefs";
import { eocTypeDefs } from "./eoc.typeDefs";
import { surveillanceTypeDefs } from "./surveillance.typeDefs";
import { labTypeDefs } from "./lab.typeDefs";
import { incidentTypeDefs } from "./incident.typeDefs";
import { sitrepTypeDefs } from "./sitrep.typeDefs";
import { responseTypeDefs } from "./response.typeDefs";
import { resourceTypeDefs } from "./resource.typeDefs";
import { dashboardTypeDefs } from "./dashboard.typeDefs";

/**
 * --------------------------------------------------
 * COMBINE ALL TYPEDEFS
 * --------------------------------------------------
 */
export const typeDefs = [
  rootTypeDefs,
  baseTypeDefs,
  userTypeDefs,
  organizationTypeDefs,
  eocTypeDefs,
  surveillanceTypeDefs,
  labTypeDefs,
  incidentTypeDefs,
  sitrepTypeDefs,
  responseTypeDefs,
  resourceTypeDefs,
  dashboardTypeDefs,
];

/**
 * --------------------------------------------------
 * (OPTIONAL) EXPORT AS DEFAULT FOR APOLLO
 * --------------------------------------------------
 */
export default typeDefs;