import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./typeDefs"; // your combined typedefs
import { resolvers } from "./resolvers"; // barrel export
import { authDirectiveTransformer } from "../directives/auth.directives";

/**
 * 1. Create base schema
 */
let schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

/**
 * 2. Apply auth directive transformation HERE
 */
schema = authDirectiveTransformer(schema);

/**
 * 3. Export final secured schema
 */
export default schema;