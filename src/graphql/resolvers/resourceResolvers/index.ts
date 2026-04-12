import { resourceMutations } from "./mutations";
import { resourceQueries } from "./queries";

const resourceResolver = {
  Mutation: resourceMutations,
  Query: resourceQueries,
};

export default resourceResolver;
