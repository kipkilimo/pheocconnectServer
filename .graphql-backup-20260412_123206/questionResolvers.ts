import { GraphQLError } from "graphql";
import Question from "../../models/Question";
import User from "../../models/User";
import { generateUniqueCode } from "../../utils/identifier_generator";
import {
  BulkQuestionError,
  BulkQuestionResult,
  BulkQuestionsInput,
  QuestionInput,
  QuestionType,
} from "../../types/questionTypes";
import { ApolloError } from "apollo-server-express";
import generateAccessKey from "../../utils/accessKeyUtility";

interface QuestionTypeCounts {
  QUICK_TRUE_FALSE?: number;
  EXPANDED_TRUE_FALSE?: number;
  SINGLE_SELECT?: number;
  MULTI_SELECT?: number;
  VERY_SHORT_ANSWER?: number;
  SHORT_ANSWER?: number;
  LONG_ANSWER?: number;
}

interface QuizFilterInput {
  userId: string;
  specialty: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  questionTypeCounts?: QuestionTypeCounts;
  limit?: number;
}

interface Quiz {
  id: string;
  _id: any;
  [key: string]: any;
}
const questionResolver = {
  Query: {
    getQuestionByShortId: async (_: any, { shortId }: { shortId: string }) => {
      const question = await Question.findOne({ shortId }).lean();
      if (!question) {
        throw new GraphQLError("Question not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return {
        ...question,
        id: question._id.toString(),
      };
    },
    getCurrentQuizzes: async (
      _: unknown,
      { filter }: { filter: QuizFilterInput },
    ) => {
      console.log("Filter ", filter, " items.");
      const userId = filter?.userId;

      // Guest handling
      const isGuest = userId === "GUEST_ACCESS" || !userId;
      const guestUsage = new Map<string, { count: number; resetTime: Date }>();

      if (isGuest) {
        const guestId = "GUEST_SESSION";
        const now = new Date();
        const usage = guestUsage.get(guestId);

        if (usage) {
          if (now > usage.resetTime) {
            guestUsage.set(guestId, {
              count: 1,
              resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            });
          } else if (usage.count >= 3) {
            throw new GraphQLError(
              "Guest limit exceeded. Maximum 3 calls per 24 hours. Please sign up for more access.",
              { extensions: { code: "GUEST_LIMIT_EXCEEDED" } },
            );
          } else {
            guestUsage.set(guestId, {
              count: usage.count + 1,
              resetTime: usage.resetTime,
            });
          }
        } else {
          guestUsage.set(guestId, {
            count: 1,
            resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          });
        }

        // Guest limit: max 50 questions per call
        filter.limit = Math.min(filter?.limit || 50, 50);
        return await fetchQuizzes(filter);
      }

      // Authenticated user flow
      const user = await User.findById(userId)
        .select("+subscriptionDetails +lastQuizRequest +quizUsage")
        .lean();

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "USER_NOT_FOUND" },
        });
      }

      const isActiveSubscriber = () => {
        const sub = user.subscriptionDetails;
        if (!sub?.status) return false;
        return (
          ["BASIC", "STANDARD", "PREMIUM"].includes(sub.status) &&
          (!sub.expiry || new Date(sub.expiry) > new Date())
        );
      };

      const activeSubscriber = isActiveSubscriber();

      if (!activeSubscriber) {
        const now = new Date();
        let needsUpdate = false;

        if (!user.dailyLimitReset || now > new Date(user.dailyLimitReset)) {
          user.resourcesUsedToday = 0;
          user.dailyLimitReset = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
          );
          needsUpdate = true;
        }

        if (user.resourcesUsedToday === undefined) {
          user.resourcesUsedToday = 0;
          needsUpdate = true;
        }

        if (user.dailyResourceLimit === undefined) {
          user.dailyResourceLimit = 512;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await User.updateOne(
            { _id: userId },
            {
              $set: {
                resourcesUsedToday: user.resourcesUsedToday,
                dailyResourceLimit: user.dailyResourceLimit,
                dailyLimitReset: user.dailyLimitReset,
              },
            },
          );
        }

        if (user.resourcesUsedToday >= user.dailyResourceLimit) {
          throw new GraphQLError(
            "Daily resource limit exceeded. Please subscribe for unlimited access.",
            { extensions: { code: "LIMIT_EXCEEDED" } },
          );
        }

        // Free users capped at 50
        filter.limit = Math.min(filter?.limit || 50, 50);
      } else {
        filter.limit = filter?.limit || 150;
      }

      return await fetchQuizzes(filter);

      // OPTIMIZED fetchQuizzes with guaranteed distribution
      async function fetchQuizzes(filter: QuizFilterInput) {
        const baseQuery: Record<string, unknown> = {};
        if (filter?.specialty) baseQuery.specialty = filter.specialty;
        if (filter?.topic?.length) baseQuery.topic = { $in: filter.topic };
        if (filter?.difficulty?.length)
          baseQuery.difficulty = { $in: filter.difficulty };

        // No filters → random sample
        if (
          !filter?.specialty &&
          !filter?.topic?.length &&
          !filter?.difficulty?.length &&
          !filter?.questionType?.length &&
          (!filter?.questionTypeCounts ||
            Object.keys(filter.questionTypeCounts).length === 0)
        ) {
          const results = await Question.aggregate([
            { $sample: { size: filter?.limit || 10 } },
          ]);
          return results.map((quiz) => ({ ...quiz, id: quiz._id.toString() }));
        }

        // DISTRIBUTION PER TYPE WITH EXACT QUANTITIES
        if (
          filter?.questionTypeCounts &&
          Object.keys(filter.questionTypeCounts).length > 0
        ) {
          const typeEntries = Object.entries(filter.questionTypeCounts);
          const limit = filter.limit || 150;

          console.log("🔍 TYPE BREAKDOWN CHECK:");
          for (const [type, count] of typeEntries) {
            const numCount = Number(count);
            if (numCount > 0) {
              const available = await Question.countDocuments({
                ...baseQuery,
                questionType: type,
              });
              console.log(
                `${type}: requested=${numCount}, available=${available}`,
              );
            }
          }

          // Track shortfalls per type
          const shortfallMap = new Map<string, number>();

          const results = await Promise.all(
            typeEntries.map(async ([type, count]) => {
              const numCount = Number(count);
              if (!numCount || numCount <= 0) return [];

              let docs = await Question.aggregate([
                { $match: { ...baseQuery, questionType: type } },
                { $sample: { size: numCount } },
              ]);

              // Fallback: remove difficulty filter
              if (docs.length < numCount && baseQuery.difficulty) {
                const { difficulty, ...queryWithoutDifficulty } = baseQuery;
                const additionalDocs = await Question.aggregate([
                  { $match: { ...queryWithoutDifficulty, questionType: type } },
                  { $sample: { size: numCount - docs.length } },
                ]);
                docs = [...docs, ...additionalDocs];
              }

              // Fallback: remove topic filter
              if (docs.length < numCount && baseQuery.topic) {
                const { topic, ...queryWithoutTopic } = baseQuery;
                const additionalDocs = await Question.aggregate([
                  { $match: { ...queryWithoutTopic, questionType: type } },
                  { $sample: { size: numCount - docs.length } },
                ]);
                docs = [...docs, ...additionalDocs];
              }

              // Final fallback: any question of this type
              if (docs.length < numCount) {
                const additionalDocs = await Question.aggregate([
                  { $match: { questionType: type } },
                  { $sample: { size: Math.min(numCount - docs.length, 50) } },
                ]);
                docs = [...docs, ...additionalDocs];
              }

              // Track shortfall
              const shortfall = numCount - docs.length;
              if (shortfall > 0) {
                shortfallMap.set(type, shortfall);
              }

              return docs;
            }),
          );

          const merged: any[] = results.flat();

          console.log(`📊 Initial fetch: ${merged.length} questions`);
          console.log(
            `📊 Type distribution achieved:`,
            results
              .map((r, i) => `${typeEntries[i][0]}: ${r.length}`)
              .join(", "),
          );

          // Handle shortfalls by fetching missing quantities per type
          if (shortfallMap.size > 0) {
            console.log(
              `⚠️ Shortfalls detected:`,
              Object.fromEntries(shortfallMap),
            );

            const supplementPromises = Array.from(shortfallMap.entries()).map(
              async ([type, shortfallCount]) => {
                // Try with original filters first
                let supplementDocs = await Question.aggregate([
                  { $match: { ...baseQuery, questionType: type } },
                  { $sample: { size: shortfallCount } },
                ]);

                // If still not enough, broaden the search
                if (supplementDocs.length < shortfallCount) {
                  const { difficulty, topic, ...queryWithoutFilters } =
                    baseQuery;
                  supplementDocs = await Question.aggregate([
                    { $match: { ...queryWithoutFilters, questionType: type } },
                    { $sample: { size: shortfallCount } },
                  ]);
                }

                return supplementDocs;
              },
            );

            const supplementResults = await Promise.all(supplementPromises);
            const allSupplement = supplementResults.flat();
            const allResults = [...merged, ...allSupplement];

            console.log(
              `✅ After supplement: ${allResults.length} questions (target: ${limit})`,
            );

            // Final check - if still short, log warning but don't add random questions
            if (allResults.length < limit) {
              console.warn(
                `⚠️ Still short ${
                  limit - allResults.length
                } questions after type-specific supplement. ` +
                  `Returning ${allResults.length} questions as requested quantities are prioritized.`,
              );
            }

            // Return without exceeding limit
            const finalResults =
              allResults.length > limit
                ? allResults.slice(0, limit)
                : allResults;

            return finalResults.map((quiz) => ({
              ...quiz,
              id: quiz._id.toString(),
            }));
          }

          // No shortfalls, just return (respect limit)
          const finalResults =
            merged.length > limit ? merged.slice(0, limit) : merged;

          console.log(
            `✅ Returning ${finalResults.length} questions (limit=${filter.limit})`,
          );

          return finalResults.map((quiz) => ({
            ...quiz,
            id: quiz._id.toString(),
          }));
        }

        // Simple filters (no questionTypeCounts)
        const quizzes = await Question.find(baseQuery)
          .limit(filter?.limit || 150)
          .sort({ createdAt: -1 })
          .lean();

        console.log("Fetched ", quizzes.length, " questions");
        return quizzes.map((quiz) => ({ ...quiz, id: quiz._id.toString() }));
      }
    },
    revisionBuilder: async (
      _: any,
      { quizSelections }: { quizSelections: any[] },
      context: any,
    ) => {
      if (!quizSelections?.length) {
        throw new GraphQLError("At least one quiz selection is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const userId = quizSelections[0].userId;
      if (!userId) {
        throw new GraphQLError("User ID is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Check user access and subscription status
      const user = await User.findById(userId)
        .select("+subscriptionDetails +lastQuizRequest +quizUsage")
        .lean();

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "USER_NOT_FOUND" },
        });
      }

      // Check premium status
      const isActiveSubscriber = () => {
        const sub = user.subscriptionDetails;
        if (!sub?.status) return false;

        const isPaidStatus = ["BASIC", "STANDARD", "PREMIUM"].includes(
          sub.status,
        );
        if (!isPaidStatus) return false;

        return !sub.expiry || new Date(sub.expiry) > new Date();
      };

      const activeSubscriber = isActiveSubscriber();

      // Handle resource limits for non-subscribers
      if (!activeSubscriber) {
        const now = new Date();
        let needsUpdate = false;

        // Reset daily limit if needed
        if (!user.dailyLimitReset || now > new Date(user.dailyLimitReset)) {
          user.resourcesUsedToday = 0;
          user.dailyLimitReset = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            0,
            0,
            0,
          );
          needsUpdate = true;
        }

        // Initialize defaults if not set
        if (user.resourcesUsedToday === undefined) {
          user.resourcesUsedToday = 0;
          needsUpdate = true;
        }

        if (user.dailyResourceLimit === undefined) {
          user.dailyResourceLimit = 512;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await User.updateOne(
            { _id: userId },
            {
              $set: {
                resourcesUsedToday: user.resourcesUsedToday,
                dailyResourceLimit: user.dailyResourceLimit,
                dailyLimitReset: user.dailyLimitReset,
              },
            },
          );
        }

        // Check daily limit
        if (user.resourcesUsedToday >= user.dailyResourceLimit) {
          throw new GraphQLError(
            "Daily resource limit exceeded. Please subscribe for unlimited access.",
            {
              extensions: { code: "LIMIT_EXCEEDED" },
            },
          );
        }
      }

      const results: any[] = [];
      const now = new Date();

      for (const selection of quizSelections) {
        // Basic validation for free users
        if (!activeSubscriber && selection.revisionType !== "SDLTEST") {
          throw new GraphQLError("Free users can only access SDLTEST", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Fetch questions
        const query: any = {
          questionType: selection.questionTypeDetails,
        };

        if (selection.topic?.length) {
          query.topic = { $in: selection.topic };
        }

        const questions = await Question.find(query)
          .limit(selection.count)
          .lean();

        if (!questions.length) continue;

        // Record usage
        await User.updateOne(
          { _id: userId },
          {
            $set: {
              [`lastQuizRequest.${selection.revisionType}`]: now,
            },
            $inc: {
              "quizUsage.total": questions.length,
              [`quizUsage.${selection.revisionType}.total`]: questions.length,
              [`quizUsage.${selection.revisionType}.${selection.questionTypeDetails}`]:
                questions.length,
              resourcesUsedToday: activeSubscriber ? 0 : questions.length,
            },
          },
        );

        results.push({
          questionType: [selection.questionTypeDetails],
          questions,
        });
      }

      if (!results.length) {
        throw new GraphQLError("No quizzes could be generated", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return results;
    },
  },

  Mutation: {
    async createBulkQuestions(
      _: any,
      { input }: { input: BulkQuestionsInput },
    ) {
      // Log the provided arguments for debugging

      const { questionsJson, questionType } = input;
      let parsedQuestions: QuestionInput[];

      try {
        parsedQuestions = JSON.parse(questionsJson);
      } catch (err) {
        throw new ApolloError("Invalid JSON in questionsJson.");
      }

      const questions: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < parsedQuestions.length; i++) {
        const question = parsedQuestions[i];

        try {
          // Basic validation
          if (
            !question.stem ||
            !question.specialty ||
            !question.topic ||
            !question.difficulty
          ) {
            throw new Error("Missing required fields.");
          }

          // Ensure question type matches bulk type
          if (question.questionType !== questionType) {
            throw new Error("Question type mismatch with bulk input.");
          }

          // Simulated save — replace with actual DB call
          const newQuestion = await Question.create({
            accessKey: generateAccessKey(),
            shortId: generateUniqueCode(12),
            ...question,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metrics: {
              timesAttempted: 0,
              timesCorrect: 0,
              timesPartiallyCorrect: 0,
              timesIncorrect: 0,
              averageTimeSeconds: 0,
              openEndedAnswers: [],
              confidenceScore: 0,
            },
          });

          questions.push(newQuestion);
        } catch (err: any) {
          errors.push({
            index: i,
            message: err.message,
            questionData: JSON.stringify(question),
          });
        }
      }

      return {
        successCount: questions.length,
        failCount: errors.length,
        questions,
        errors,
      };
    },

    createQuestion: async (_: any, { input }: { input: any }) => {
      if (!input.stem?.trim()) {
        throw new GraphQLError("Question stem is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const requiresChoices = [
        QuestionType.SINGLE_SELECT,
        QuestionType.MULTI_SELECT,
      ].includes(input.questionType);

      if (requiresChoices && (!input.choices || input.choices.length === 0)) {
        throw new GraphQLError("Choices are required for this question type", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const question = new Question({
        ...input,
        shortId: generateUniqueCode(11),
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {
          timesAttempted: 0,
          timesCorrect: 0,
          timesIncorrect: 0,
        },
      });

      const savedQuestion = await question.save();
      return savedQuestion.toObject();
    },
  },
};

export default questionResolver;
