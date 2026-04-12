import examQueries from "./queries";
import examMutations from "./mutations";

const examResolvers = {
  ...examQueries,
  ...examMutations,
};

export default examResolvers;
