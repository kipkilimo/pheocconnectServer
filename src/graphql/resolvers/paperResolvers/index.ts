// resolvers/paperResolvers/index.ts
import paperQueries from "./queries";
import paperMutations from "./mutations";
import Paper from "../../../models/Paper";
import Annotation from "../../../models/Annotation";
import User from "../../../models/User";

// Field resolvers for Paper type
const paperFieldResolvers = {
  Paper: {
    async createdBy(paper: any) {
      if (typeof paper.createdBy === "object" && paper.createdBy !== null) {
        return paper.createdBy;
      }
      return await User.findById(paper.createdBy);
    },

    async annotations(paper: any) {
      return await Annotation.find({ paperId: paper.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    },

    async annotationCount(paper: any) {
      if (paper.annotationCount !== undefined) return paper.annotationCount;
      return await Annotation.countDocuments({ paperId: paper.id });
    },
  },

  // Field resolvers for Annotation type
  Annotation: {
    async author(annotation: any) {
      if (typeof annotation.author === "object" && annotation.author !== null) {
        return annotation.author;
      }
      return await User.findById(annotation.authorId);
    },
  },
};

// Combine all resolvers
const paperResolver = {
  Query: paperQueries,
  Mutation: paperMutations,
  ...paperFieldResolvers,
};

export default paperResolver;
