import Paper from "../../models/Paper";
import User from "../../models/User";
import mongoose from "mongoose";

const transformAnnotation = (annotation: any) => ({
  id: annotation.id,
  page: annotation.page,
  rect: annotation.rect,
  title: annotation.title,
  text: annotation.text,
  author: annotation.author,
  reactions: annotation.reactions || [],
  createdAt: annotation.createdAt,
  updatedAt: annotation.updatedAt,
});

const transformReaction = (reaction: any) => ({
  id: reaction.id,
  type: reaction.type,
  text: reaction.text,
  author: reaction.author,
  createdAt: reaction.createdAt,
});

export const annotationResolvers = {
  Query: {
    async getPaperAnnotations(_: any, { paperId, page, limit = 50 }: any) {
      try {
        const paper = await Paper.findById(paperId).lean();
        if (!paper) throw new Error("Paper not found");

        let annotations = paper.annotations || [];

        if (page != null) {
          annotations = annotations.filter((a: any) => a.page === page);
        }

        return annotations.slice(0, limit).map(transformAnnotation);
      } catch (err) {
        console.error(err);
        throw new Error("Failed to fetch annotations");
      }
    },

    async getMyPaperAnnotations(_: any, __: any, { user }: any) {
      if (!user?.id) throw new Error("Not authenticated");

      const papers = await Paper.find({
        "annotations.author.id": user.id,
      }).lean();

      return papers
        .flatMap((p: any) =>
          (p.annotations || []).filter((a: any) => a.author.id === user.id),
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 100)
        .map(transformAnnotation);
    },
  },

  Mutation: {
    async createPaperAnnotation(_: any, { input }: any, { user }: any) {
      if (!user?.id) throw new Error("Not authenticated");

      const { paperId, page, x, y, width, height, title, text } = input;

      const paper = await Paper.findById(paperId);
      if (!paper) throw new Error("Paper not found");

      const author = await User.findById(user.id).lean();
      if (!author) throw new Error("User not found");

      const annotation = {
        id: new mongoose.Types.ObjectId().toString(),
        page,
        rect: { x, y, width, height },
        title,
        text,
        author: {
          id: user.id,
          name:
            author.personalInfo?.fullName ||
            author.personalInfo?.username ||
            "Anonymous",
          emailAddress: author.personalInfo?.email || "", // Changed from 'email' to 'emailAddress'
        },
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      paper.annotations.push(annotation);
      paper.annotationCount = paper.annotations.length;
      await paper.save();

      return transformAnnotation(annotation);
    },

    async updatePaperAnnotation(_: any, { input }: any, { user }: any) {
      const paper = await Paper.findOne({
        "annotations.id": input.id,
      });

      if (!paper) throw new Error("Annotation not found");

      const annotation = paper.annotations.find((a: any) => a.id === input.id);

      if (!annotation) throw new Error("Annotation not found");

      if (annotation.author.id !== user.id) {
        throw new Error("Not allowed");
      }

      annotation.text = input.text;
      if (input.title !== undefined) annotation.title = input.title;
      annotation.updatedAt = new Date().toISOString();

      await paper.save();
      return transformAnnotation(annotation);
    },

    async deletePaperAnnotation(_: any, { id }: any, { user }: any) {
      const paper = await Paper.findOne({ "annotations.id": id });
      if (!paper) return false;

      const annotation = paper.annotations.find((a: any) => a.id === id);

      if (!annotation || annotation.author.id !== user.id) {
        throw new Error("Not allowed");
      }

      paper.annotations = paper.annotations.filter((a: any) => a.id !== id);

      paper.annotationCount = paper.annotations.length;
      await paper.save();

      return true;
    },

    async addPaperReaction(_: any, { input }: any, { user }: any) {
      if (!user?.id) throw new Error("Not authenticated");

      const { annotationId, type, text } = input;

      const paper = await Paper.findOne({
        "annotations.id": annotationId,
      });

      if (!paper) throw new Error("Annotation not found");

      const annotation = paper.annotations.find(
        (a: any) => a.id === annotationId,
      );

      if (!annotation) throw new Error("Annotation not found");

      // Get user details for the reaction author
      const author = await User.findById(user.id).lean();

      const reaction = {
        id: new mongoose.Types.ObjectId().toString(),
        type,
        text: text || null,
        author: {
          id: user.id,
          name:
            author?.personalInfo?.fullName ||
            author?.personalInfo?.username ||
            "Anonymous",
          emailAddress: author?.personalInfo?.email || "", // Changed from 'email' to 'emailAddress'
        },
        createdAt: new Date().toISOString(),
      };

      annotation.reactions.push(reaction);
      await paper.save();

      return transformReaction(reaction);
    },

    async removePaperReaction(_: any, { id }: any, { user }: any) {
      if (!user?.id) throw new Error("Not authenticated");

      const paper = await Paper.findOne({
        "annotations.reactions.id": id,
      });

      if (!paper) return false;

      for (const annotation of paper.annotations) {
        const reactionIndex = annotation.reactions.findIndex(
          (r: any) => r.id === id,
        );

        if (reactionIndex !== -1) {
          const reaction = annotation.reactions[reactionIndex];

          if (reaction.author.id !== user.id) {
            throw new Error("Not allowed");
          }

          annotation.reactions.splice(reactionIndex, 1);
          await paper.save();
          return true;
        }
      }

      return false;
    },
  },
};
