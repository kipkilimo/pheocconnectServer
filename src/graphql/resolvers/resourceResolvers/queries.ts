import Resource from "../../../models/Resource";
import User from "../../../models/User";
import { GraphQLError } from "graphql";
import { fuzzy } from "fast-fuzzy";
import {
  IGetResourcesArgs,
  LiveResourceParams,
  ResourceSuggestion,
  IResource,
} from "./types";
import {
  checkActiveSubscription,
  isValidObjectId,
  parseJsonParams,
  formatPublicationTrends,
} from "./utils";

// Type for populated user in resources
interface PopulatedUser {
  id: string;
  personalInfo: {
    username: string;
    fullName: string;
    email: string;
    scholarId: string;
    activationToken: string;
    resetToken: string;
    tokenExpiry: Date;
    activatedAccount: boolean;
  };
  role: string;
}

// Type for task with participants
interface TaskWithParticipants {
  participants: string;
  _id: any;
}

// Type for assignment with parsed content
interface AssignmentWithMeta {
  id: string;
  title: string;
  coverImage?: string;
  description?: string;
  subject?: string;
  topic?: string;
  createdBy: PopulatedUser;
  createdAt: Date;
  sessionId: string;
  accessKey: string;
  participants: string;
  assignmentType: string | null;
  assignmentTitle: string | null;
  assignmentDescription: string | null;
  assignmentDuration: string | null;
  assignmentDeadline: string | null;
  assignmentAnswersKey: any;
  assignmentTaskSet: any;
}

export const resourceQueries = {
  async getUserTasks(_: any, { userId }: { userId: string }) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const tasks = await Resource.find({
      contentType: "TASK",
      createdAt: {
        $gte: oneMonthAgo,
      },
    })
      .populate({
        path: "createdBy",
        model: "User",
        select: {
          id: 1,
          personalInfo: {
            username: 1,
            fullName: 1,
            email: 1,
            scholarId: 1,
            activationToken: 1,
            resetToken: 1,
            tokenExpiry: 1,
            activatedAccount: 1,
          },
          role: 1,
        },
      })
      .sort({ createdAt: -1 });

    const filteredTasks = tasks.filter((task: TaskWithParticipants) => {
      try {
        const participants = JSON.parse(task.participants);
        return participants.some(
          (participant: { userId: string; requestStatus: string }) =>
            participant.userId === userId &&
            participant.requestStatus === "ENROLLED",
        );
      } catch (error) {
        console.error(
          `Error parsing task content for task ${task._id}:`,
          error,
        );
        return false;
      }
    });

    return filteredTasks;
  },

  getAllMockExams: async (
    _: any,
    { resourceType }: { resourceType: string },
  ) => {
    try {
      const reqParams = parseJsonParams<{
        resourceType: string;
        subject?: string;
        topic?: string;
        country?: string;
        targetRegion?: string;
        language?: string;
      }>(resourceType);

      const query: Record<string, unknown> = {
        contentType: reqParams.resourceType,
        ...(reqParams.subject && { subject: reqParams.subject }),
        ...(reqParams.topic && { topic: reqParams.topic }),
        ...(reqParams.country && {
          country: new RegExp(reqParams.country, "i"),
        }),
        ...(reqParams.targetRegion && {
          targetRegion: reqParams.targetRegion,
        }),
        ...(reqParams.language && { language: reqParams.language }),
      };

      const exams = await Resource.find(query).sort({ createdAt: -1 }).lean();

      return exams
        .map((exam: any) => {
          try {
            const parsedContent = JSON.parse(exam.content);
            const { examMetaInfo, examAnswersKey, examQuestionsSet } =
              parsedContent;

            exam.examMetaInfo = JSON.parse(examMetaInfo);
            exam.examMetaInfo.examAnswersKey = JSON.parse(examAnswersKey);
            exam.examMetaInfo.examQuestionsSet = JSON.parse(examQuestionsSet);
            return exam;
          } catch (error) {
            console.error(
              "Error parsing exam content for exam ID:",
              exam._id,
              error,
            );
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error("Error fetching mock exams:", error);
      throw new Error("Failed to fetch exams.");
    }
  },

  async getPublisherLatestTasks(_: any, { userId }: { userId: string }) {
    try {
      let assignments = await Resource.find({
        createdBy: userId,
        contentType: "TASK",
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .populate({
          path: "createdBy",
          model: "User",
          select: {
            id: 1,
            personalInfo: {
              username: 1,
              fullName: 1,
              email: 1,
              scholarId: 1,
              activationToken: 1,
              resetToken: 1,
              tokenExpiry: 1,
              activatedAccount: 1,
            },
            role: 1,
          },
        });

      if (!assignments || assignments.length === 0) {
        assignments = await Resource.find({
          contentType: "TASK",
          participants: userId,
        })
          .sort({ createdAt: -1 })
          .limit(12)
          .populate({
            path: "createdBy",
            model: "User",
            select: {
              id: 1,
              personalInfo: {
                username: 1,
                fullName: 1,
                email: 1,
                scholarId: 1,
                activationToken: 1,
                resetToken: 1,
                tokenExpiry: 1,
                activatedAccount: 1,
              },
              role: 1,
            },
          });
      }

      const formattedAssignments: AssignmentWithMeta[] = assignments.map(
        (assignment: any) => {
          try {
            const parsedContent = JSON.parse(assignment.content || "{}");
            const metaInfo = parsedContent.assignmentMetaInfo
              ? JSON.parse(parsedContent.assignmentMetaInfo)
              : {};

            return {
              id: assignment.id,
              title: assignment.title,
              coverImage: assignment.coverImage,
              description: assignment.description,
              subject: assignment.subject,
              topic: assignment.topic,
              createdBy: assignment.createdBy,
              createdAt: assignment.createdAt,
              sessionId: assignment.sessionId,
              accessKey: assignment.accessKey,
              participants: assignment.participants,
              assignmentType: metaInfo.assignmentType || null,
              assignmentTitle: metaInfo.assignmentTitle || null,
              assignmentDescription: metaInfo.assignmentDescription || null,
              assignmentDuration: metaInfo.assignmentDuration || null,
              assignmentDeadline: metaInfo.assignmentDeadline || null,
              assignmentAnswersKey: parsedContent.assignmentAnswersKey
                ? JSON.parse(parsedContent.assignmentAnswersKey)
                : null,
              assignmentTaskSet: parsedContent.assignmentTaskSet
                ? JSON.parse(parsedContent.assignmentTaskSet)
                : null,
            };
          } catch (error) {
            console.error(
              "Error parsing content for assignment:",
              assignment.id,
              error,
            );
            return assignment;
          }
        },
      );

      return formattedAssignments;
    } catch (error) {
      console.error("Error fetching tasks for user:", userId, error);
      throw new Error("Failed to fetch latest tasks");
    }
  },

  async getPublisherLatestPoll(_: any, { userId }: { userId: string }) {
    let poll = await Resource.findOne({
      createdBy: userId,
      contentType: "POLL",
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "createdBy",
        model: "User",
        select: {
          id: 1,
          personalInfo: {
            username: 1,
            fullName: 1,
            email: 1,
            scholarId: 1,
            activationToken: 1,
            resetToken: 1,
            tokenExpiry: 1,
            activatedAccount: 1,
          },
          role: 1,
        },
      });

    if (!poll) {
      poll = await Resource.findOne({
        contentType: "POLL",
        participants: userId,
      })
        .sort({ createdAt: -1 })
        .populate({
          path: "createdBy",
          model: "User",
          select: {
            id: 1,
            personalInfo: {
              username: 1,
              fullName: 1,
              email: 1,
              scholarId: 1,
              activationToken: 1,
              resetToken: 1,
              tokenExpiry: 1,
              activatedAccount: 1,
            },
            role: 1,
          },
        });
    }

    return poll;
  },

  async fetchComputingResource(
    _: any,
    { topicParams }: { topicParams: string },
  ) {
    console.log("[fetchComputingResource] START - Args:", {
      topicParams,
      topicParamsType: typeof topicParams,
      timestamp: new Date().toISOString(),
    });

    try {
      // Parse JSON parameters
      console.log("[fetchComputingResource] Parsing JSON params...");
      const params = parseJsonParams<{
        language: { name: string; icon?: string } | string;
        topic: string;
      }>(topicParams);

      // Handle both string and object language formats
      const queryLang =
        typeof params.language === "string"
          ? params.language
          : params.language?.name;

      console.log("[fetchComputingResource] Parsed params:", {
        language: queryLang,
        topic: params.topic,
        hasLanguage: !!params.language,
        hasTopic: !!params.topic,
      });

      // Validate required fields
      if (!params.topic || params.topic.trim() === "") {
        console.error("[fetchComputingResource] Missing or empty topic");
        throw new Error("Topic parameter is required and cannot be empty");
      }

      // Language is required for this query
      if (!queryLang) {
        console.error(
          "[fetchComputingResource] Language parameter is required",
        );
        throw new Error("Language parameter is required");
      }

      // Validate language is supported
      const supportedLanguages = ["Python", "R", "STATA"];
      if (!supportedLanguages.includes(queryLang)) {
        console.error(
          `[fetchComputingResource] Unsupported language: ${queryLang}. Supported languages: ${supportedLanguages.join(", ")}`,
        );
        throw new Error(
          `Unsupported language: ${queryLang}. Supported languages: ${supportedLanguages.join(", ")}`,
        );
      }

      // Use flexible topic matching with regex (NOT exact match)
      const topicQuery = params.topic.trim();
      console.log(
        "[fetchComputingResource] Querying database with regex for topic:",
        topicQuery,
      );

      // Build query with BOTH topic and language conditions (AND logic)
      const searchConditions: any[] = [
        { title: { $regex: topicQuery, $options: "i" } },
        { topic: { $regex: topicQuery, $options: "i" } },
        { description: { $regex: topicQuery, $options: "i" } },
      ];

      // Build query with required language match
      const query = {
        $or: searchConditions,
        language: { $regex: new RegExp(`^${queryLang}$`, "i") }, // Exact language match required
      };

      console.log(
        "[fetchComputingResource] Final query:",
        JSON.stringify(query, null, 2),
      );

      // Execute query with required language filter
      const resources = await Resource.find(query)
        .populate({
          path: "createdBy",
          model: "User",
          select: {
            id: 1,
            personalInfo: {
              username: 1,
              fullName: 1,
              email: 1,
              scholarId: 1,
            },
            role: 1,
          },
        })
        .sort({ createdAt: -1 })
        .limit(10);

      console.log("[fetchComputingResource] Query results:", {
        count: resources.length,
        found: resources.length > 0,
        languageFilter: queryLang,
        timestamp: new Date().toISOString(),
      });

      // Return null if no resources found with exact language match
      if (resources.length === 0) {
        console.warn(
          "[fetchComputingResource] No resources found matching topic:",
          topicQuery,
          `with exact language: ${queryLang}`,
        );
        return null; // Return null, no fallback
      }

      // Find best match by prioritizing exact topic match
      let bestMatch = resources[0];

      // Try to find resource that has exact topic match (title or topic field)
      const exactTopicMatch = resources.find(
        (r) =>
          r.title?.toLowerCase() === topicQuery.toLowerCase() ||
          r.topic?.toLowerCase() === topicQuery.toLowerCase(),
      );

      if (exactTopicMatch) {
        bestMatch = exactTopicMatch;
        console.log(
          "[fetchComputingResource] Selected best match with exact topic match",
        );
      } else {
        console.log(
          "[fetchComputingResource] Using first result as best match (no exact topic match found)",
        );
      }

      console.log("[fetchComputingResource] Returning resource:", {
        id: bestMatch._id,
        title: bestMatch.title,
        topic: bestMatch.topic,
        language: bestMatch.language,
        contentType: bestMatch.contentType,
        matchedLanguage: queryLang,
      });

      return bestMatch;
    } catch (error) {
      console.error("[fetchComputingResource] ERROR:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        topicParams,
        topicParamsType: typeof topicParams,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },

  async getLIVEResource(_: any, { accessKey }: { accessKey: string }) {
    try {
      const reqParamsRaw = parseJsonParams<LiveResourceParams>(accessKey);
      let resource;

      if (reqParamsRaw.userId && reqParamsRaw.resourceType) {
        const { userId, resourceType } = reqParamsRaw;
        resource = await Resource.findOne({
          createdBy: userId,
          contentType: resourceType,
        })
          .sort({ createdAt: -1 })
          .populate({
            path: "createdBy",
            model: "User",
            select: {
              id: 1,
              "personalInfo.username": 1,
              "personalInfo.fullName": 1,
              "personalInfo.email": 1,
              "personalInfo.scholarId": 1,
              role: 1,
            },
          });
      } else if (reqParamsRaw.accessKey && reqParamsRaw.sessionId) {
        const { accessKey: accessKeyValue, sessionId } = reqParamsRaw;
        resource = await Resource.findOne({
          accessKey: accessKeyValue,
          sessionId,
        }).populate({
          path: "createdBy",
          model: "User",
          select: {
            id: 1,
            "personalInfo.username": 1,
            "personalInfo.fullName": 1,
            "personalInfo.email": 1,
            "personalInfo.scholarId": 1,
            role: 1,
          },
        });
      } else {
        console.warn("Invalid reqParamsRaw structure:", reqParamsRaw);
        return null;
      }

      if (!resource) {
        console.warn("No LIVE resource found for the provided parameters.");
        return null;
      }

      return resource;
    } catch (error) {
      console.error("Error fetching LIVE resource:", error);
      throw new Error("Failed to fetch LIVE resource.");
    }
  },

  async getResource(_: any, { id }: { id: string }) {
    const resource = await Resource.findOne({ _id: id }).populate({
      path: "createdBy",
      model: "User",
      select: {
        id: 1,
        personalInfo: {
          username: 1,
          fullName: 1,
          email: 1,
          scholarId: 1,
          activationToken: 1,
          resetToken: 1,
          tokenExpiry: 1,
          activatedAccount: 1,
        },
        role: 1,
      },
    });
    return resource;
  },

  getQuestions: async (_: any, { resourceId }: { resourceId: string }) => {
    try {
      const resource = await Resource.findById(resourceId)
        .select("questions")
        .exec();
      if (!resource) {
        throw new Error("Resource not found");
      }
      return resource.questions;
    } catch (error) {
      throw new Error("Could not fetch questions");
    }
  },

  async getAllTaskResources(_: any) {
    try {
      const resources = await Resource.find({ contentType: "TASK" }).populate({
        path: "createdBy",
        model: "User",
        select: {
          id: 1,
          personalInfo: {
            username: 1,
            fullName: 1,
            email: 1,
            scholarId: 1,
            activationToken: 1,
            resetToken: 1,
            tokenExpiry: 1,
            activatedAccount: 1,
          },
          role: 1,
        },
      });
      return resources;
    } catch (error) {
      console.error("Error fetching resources:", error);
      throw new Error("Failed to fetch resources");
    }
  },

  async getAllResources(_: any, args: IGetResourcesArgs) {
    try {
      const resources = await Resource.find(
        { isPublished: false },
        {
          _id: 1,
          contentType: 1,
          title: 1,
          viewsNumber: 1,
          likesNumber: 1,
          sharesNumber: 1,
          subject: 1,
          topic: 1,
          averageRating: 1,
          createdAt: 1,
          isPublished: 1,
        },
      ).populate({
        path: "createdBy",
        model: "User",
        select: {
          _id: 1,
          personalInfo: {
            fullName: 1,
            email: 1,
          },
          role: 1,
        },
      });

      // Transform to include id field
      return resources.map((resource: any) => ({
        ...resource,
        id: resource._id,
      }));
    } catch (error) {
      throw new Error("Failed to fetch resources");
    }
  },

  async getAllSearchResults(_: any, args: IGetResourcesArgs) {
    const debug = (message: string, data?: any) => {
      console.debug(
        `[DEBUG][${new Date().toISOString()}] ${message}`,
        data || "",
      );
    };

    try {
      debug("Starting getAllSearchResults", { args });

      const { searchQuery, userId } = args;
      debug("Extracted parameters", { searchQuery, userId });

      if (!userId || userId.length !== 24) {
        debug("Invalid User ID provided", { userId });
        throw new GraphQLError("Invalid User ID.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (
        !searchQuery ||
        typeof searchQuery !== "string" ||
        !searchQuery.trim()
      ) {
        debug("Invalid search query provided", { searchQuery });
        throw new GraphQLError("Invalid search query.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const sanitizedQuery = searchQuery.trim().toLowerCase();
      debug("Sanitized search query", { sanitizedQuery });

      const resourceTypes = new Set([
        "AUDIO",
        "VIDEO",
        "DOCUMENT",
        "MIXED",
        "TEXT",
        "PRESENTATION",
        "TASK",
        "IMAGES",
      ]);

      debug("Fetching user data", { userId });
      const user = await User.findById(userId)
        .select(
          "+subscriptionDetails +resourcesUsedToday +dailyResourceLimit +dailyLimitReset",
        )
        .lean();

      if (!user) {
        debug("User not found", { userId });
        throw new GraphQLError("User not found.", {
          extensions: { code: "USER_NOT_FOUND" },
        });
      }

      const activeSubscriber = checkActiveSubscription(user);
      debug("Subscription status check", { activeSubscriber });

      if (!activeSubscriber) {
        debug("Processing non-subscriber limits");
        const now = new Date();
        let needsUpdate = false;

        if (!user.dailyLimitReset || now > new Date(user.dailyLimitReset)) {
          debug("Resetting daily limit counters");
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

        if (user.resourcesUsedToday === undefined) {
          user.resourcesUsedToday = 0;
          needsUpdate = true;
        }

        if (user.dailyResourceLimit === undefined) {
          user.dailyResourceLimit = 512;
          needsUpdate = true;
        }

        if (needsUpdate) {
          debug("Updating user with new limit data");
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
          debug("Daily limit exceeded", {
            used: user.resourcesUsedToday,
            limit: user.dailyResourceLimit,
          });
          throw new GraphQLError(
            "Daily resource limit exceeded. Please subscribe for unlimited access.",
            { extensions: { code: "LIMIT_EXCEEDED" } },
          );
        }
      }

      debug("Searching for resources", { sanitizedQuery });
      const searchRegex = new RegExp(sanitizedQuery, "i");

      const rawResults = await Resource.find(
        {
          contentType: { $in: [...resourceTypes] },
          $or: [
            { title: searchRegex },
            { subject: searchRegex },
            { topic: searchRegex },
            { description: searchRegex },
            { keywords: searchRegex },
          ],
        },
        {
          _id: 1,
          contentType: 1,
          title: 1,
          viewsNumber: 1,
          likesNumber: 1,
          sharesNumber: 1,
          subject: 1,
          topic: 1,
          coverImage: 1,
          averageRating: 1,
          createdAt: 1,
          keywords: 1,
          description: 1,
        },
      ).lean();

      debug("Raw search results count", rawResults.length);

      if (!rawResults.length) {
        debug("No results found");
        return [];
      }

      const transformedResults = rawResults.map((resource: any) => ({
        ...resource,
        id: resource._id.toString(),
      }));

      const fuzzyMatch = (str: string) => fuzzy(sanitizedQuery, str);

      const rankedResults = transformedResults
        .map((resource: any) => {
          const searchContent = [
            resource.title,
            resource.subject,
            resource.topic,
            resource.description,
            ...(resource.keywords || []),
          ]
            .filter(Boolean)
            .join(" ");

          const score = fuzzyMatch(searchContent);
          return score >= 0.7 ? { ...resource, score } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.score - a.score);

      debug("Ranked results count", rankedResults.length);

      if (!activeSubscriber && rankedResults.length > 0) {
        debug("Updating resource usage count");
        await User.updateOne(
          { _id: userId },
          { $inc: { resourcesUsedToday: 1 } },
        );
      }

      debug("Returning ranked results");
      return rankedResults;
    } catch (error) {
      console.error("Error fetching search results:", error);
      debug("Error occurred", { error });
      throw new GraphQLError("Failed to fetch search results.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },

  async getAllRecentNewsArticles(_: unknown): Promise<any[]> {
    try {
      const sixtyMonthsAgo = new Date();
      sixtyMonthsAgo.setMonth(sixtyMonthsAgo.getMonth() - 60);

      const query: Record<string, unknown> = {
        contentType: "ARTICLE",
        createdAt: { $gte: sixtyMonthsAgo },
      };

      const resources = await Resource.find(query, {
        _id: 1,
        contentType: 1,
        title: 1,
        viewsNumber: 1,
        likesNumber: 1,
        sharesNumber: 1,
        subject: 1,
        topic: 1,
        content: 1,
        coverImage: 1,
        averageRating: 1,
        createdAt: 1,
        keywords: 1,
        description: 1,
      })
        .sort({ createdAt: -1 })
        .limit(45);

      if (resources.length === 0) {
        return [];
      }

      // Transform to include id field
      return resources.map((resource: any) => ({
        ...resource,
        id: resource._id,
      }));
    } catch (error) {
      console.error("Error fetching resources:", error);
      throw new Error("Failed to fetch resources");
    }
  },

  async getAllTopicResourcesByTopic(
    _: any,
    args: IGetResourcesArgs,
    context: any,
  ) {
    console.log(
      "getAllTopicResourcesByTopic called with args:",
      JSON.stringify(args, null, 2),
    );

    try {
      let { resourceTitle, userId } = args;

      if (!userId && context.user) {
        userId = context.user.id || context.user._id;
        console.log(`Using userId from context: ${userId}`);
      }

      console.log(`Validating userId: ${userId}`);

      const isGuest =
        !userId ||
        userId === "GUEST_ACCESS" ||
        userId === "GUEST" ||
        userId === "guest";

      if (!isGuest) {
        if (!isValidObjectId(userId)) {
          console.error("Invalid User ID format:", userId);
          throw new GraphQLError("Invalid User ID format.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
      }

      console.log(`Validating resourceTitle: ${resourceTitle}`);
      if (
        !resourceTitle ||
        typeof resourceTitle !== "string" ||
        !resourceTitle.trim()
      ) {
        console.error("Invalid resource title provided:", resourceTitle);
        throw new GraphQLError("Invalid resource title.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const resourceTypes = [
        "AUDIO",
        "VIDEO",
        "DOCUMENT",
        "MIXED",
        "TEXT",
        "PRESENTATION",
        "TASK",
        "IMAGES",
      ];

      let user: any = null;
      let isSubscriber = false;

      if (!isGuest && userId) {
        console.log(`Fetching user with ID: ${userId}`);
        user = await User.findById(userId).select(
          "+subscriptionDetails +resourcesUsedToday +dailyResourceLimit +dailyLimitReset",
        );

        if (!user) {
          console.error(`User not found with ID: ${userId}`);
          throw new GraphQLError("User not found.", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }

        isSubscriber = checkActiveSubscription(user);
        console.log(`User ${user._id} is active subscriber: ${isSubscriber}`);
      } else {
        console.log("Guest user detected - no limits applied");
        isSubscriber = false;
      }

      if (!isSubscriber) {
        if (!isGuest && user) {
          console.log("Handling resource limits for free/trial user");
          const now = new Date();
          let needsUpdate = false;

          if (!user.dailyLimitReset || now > new Date(user.dailyLimitReset)) {
            console.log("Resetting daily limit counters");
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

          if (user.resourcesUsedToday === undefined) {
            console.log("Initializing resourcesUsedToday to 0");
            user.resourcesUsedToday = 0;
            needsUpdate = true;
          }

          if (user.dailyResourceLimit === undefined) {
            console.log("Setting default daily resource limit (10)");
            user.dailyResourceLimit = 512;
            needsUpdate = true;
          }

          if (needsUpdate) {
            console.log("Saving user with updated limit fields");
            await user.save();
          }

          console.log(
            `Checking resource usage: ${user.resourcesUsedToday}/${user.dailyResourceLimit}`,
          );
          if (user.resourcesUsedToday >= user.dailyResourceLimit) {
            console.error(`Daily limit exceeded for user ${user._id}`);
            throw new GraphQLError(
              "Daily resource limit exceeded. Please subscribe for unlimited access.",
              { extensions: { code: "LIMIT_EXCEEDED" } },
            );
          }
        } else {
          console.log("Guest user - no limit tracking applied");
        }
      }

      console.log(`Fetching resources for topic: ${resourceTitle.trim()}`);

      const resources = await Resource.find(
        {
          topic: { $regex: new RegExp(`^${resourceTitle.trim()}$`, "i") },
          contentType: { $in: resourceTypes },
        },
        {
          _id: 1,
          contentType: 1,
          title: 1,
          viewsNumber: 1,
          likesNumber: 1,
          sharesNumber: 1,
          subject: 1,
          topic: 1,
          coverImage: 1,
          averageRating: 1,
          createdAt: 1,
          keywords: 1,
          description: 1,
        },
      ).lean();

      console.log(
        `Found ${resources.length} resources for topic ${resourceTitle}`,
      );

      const transformedResources = resources.map((resource: any) => ({
        ...resource,
        id: resource._id.toString(),
      }));

      if (!isSubscriber && !isGuest && user && resources.length > 0) {
        console.log(`Incrementing resource count for free user ${user._id}`);
        user.resourcesUsedToday += 1;
        await user.save();
        console.log(`Updated resourcesUsedToday to ${user.resourcesUsedToday}`);
      } else if (isGuest && resources.length > 0) {
        console.log(
          `Guest user accessed ${resources.length} resources - no tracking`,
        );
      }

      return transformedResources;
    } catch (error) {
      console.error("Error in getAllTopicResourcesByTopic:", {
        error: error,
        stack: error instanceof Error ? error.stack : undefined,
        args,
      });

      if (error instanceof GraphQLError) {
        throw error;
      }

      throw new GraphQLError("Failed to fetch topic resources.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },

  async getAllSpecificTypeResources(
    _: unknown,
    { resourceType }: { resourceType: string },
  ): Promise<any[]> {
    try {
      const valsRaw = JSON.parse(resourceType);
      const vals = valsRaw[0];

      const reqParams = {
        resourceType: vals.resourceType,
        subject: vals.selectedSubject,
        topic: vals.selectedTopic,
        country: vals.selectedCountry,
        targetRegion: vals.selectedTargetRegion,
        language: vals.selectedLanguage,
      };

      const query: Record<string, unknown> = {
        contentType: reqParams.resourceType,
      };

      if (reqParams.subject) {
        query.subject = reqParams.subject;
      }
      if (reqParams.topic) {
        query.topic = reqParams.topic;
      }
      if (reqParams.country) {
        query.country = { $regex: new RegExp(reqParams.country, "i") };
      }
      if (reqParams.targetRegion) {
        query.targetRegion = reqParams.targetRegion;
      }
      if (reqParams.language) {
        query.language = reqParams.language;
      }

      let resources = await Resource.find(query, {
        _id: 1,
        contentType: 1,
        title: 1,
        viewsNumber: 1,
        likesNumber: 1,
        sharesNumber: 1,
        subject: 1,
        topic: 1,
        coverImage: 1,
        averageRating: 1,
        createdAt: 1,
        keywords: 1,
        description: 1,
      });

      if (resources.length === 0) {
        const generalQuery: Record<string, unknown> = {
          contentType: reqParams.resourceType,
        };
        resources = await Resource.find(generalQuery).limit(3).exec();
      }

      // Transform to include id field
      return resources.map((resource: any) => ({
        ...(resource.toObject ? resource.toObject() : resource),
        id: resource._id,
      }));
    } catch (error) {
      console.error("Error fetching resources:", error);
      throw new Error("Failed to fetch resources");
    }
  },

  async fetchResourceSummaryByRoleAndType() {
    try {
      const resourceCountsPromise = Resource.aggregate([
        {
          $group: {
            _id: "$contentType",
            count: { $sum: 1 },
          },
        },
      ]);

      const [mostLikedResource, mostRequestedResource, mostCreatedResource] =
        await Promise.all([
          Resource.findOne()
            .sort({ likesNumber: -1 })
            .select("title likesNumber"),
          Resource.findOne()
            .sort({ viewsNumber: -1 })
            .select("title viewsNumber"),
          Resource.findOne({ createdAt: { $ne: null } })
            .sort({ createdAt: -1 })
            .select("title createdAt"),
        ]);

      const publicationTrends = await Resource.aggregate([
        {
          $match: { createdAt: { $ne: null } },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      publicationTrends.forEach((item: { _id: { month: null } }) => {
        if (item._id.month === null) {
          console.warn("Found a null month in publication trends", item);
        }
      });

      const formattedPublicationTrends =
        formatPublicationTrends(publicationTrends);
      const resourceCounts = await resourceCountsPromise;

      const summary = resourceCounts.reduce(
        (acc: { [x: string]: any }, { _id, count }: any) => {
          const key = `${_id.toLowerCase()}Count`;
          acc[key] = count;
          return acc;
        },
        {},
      );

      summary.mostLikedResource = mostLikedResource;
      summary.mostRequestedResource = mostRequestedResource;
      summary.mostCreatedResource = mostCreatedResource;
      summary.publicationTrends = formattedPublicationTrends;

      return [summary];
    } catch (error) {
      console.error("Error in fetchResourceSummaryByRoleAndType:", error);
      throw error;
    }
  },

  async getResources(_: any, args: IGetResourcesArgs) {
    try {
      const filter: Partial<IGetResourcesArgs> = {};

      if (args.subject) filter.subject = args.subject;
      if (args.topic) filter.topic = args.topic;
      if (args.title) filter.title = args.title;
      if (args.contentType) filter.contentType = args.contentType;
      if (args.targetRegion) filter.targetRegion = args.targetRegion;
      if (args.language) filter.language = args.language;

      const resources = await Resource.find(filter).populate({
        path: "createdBy",
        model: "User",
      });

      return resources;
    } catch (error) {
      console.error("Error fetching resources:", error);
      throw new Error("Failed to fetch resources");
    }
  },

  async getRecentResources(_: any, { userId }: { userId: string }) {
    try {
      const user = await User.findById(userId)
        .populate({
          path: "recent_resources",
          model: "Resource",
          select:
            "_id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
        })
        .exec();

      if (!user) {
        throw new Error("User not found");
      }

      // Transform to include id field
      const recentResources = user.recent_resources || [];
      return recentResources.map((resource: any) => ({
        ...(resource.toObject ? resource.toObject() : resource),
        id: resource._id,
      }));
    } catch (error) {
      console.error("Error fetching recent resources:", error);
      throw new Error("Failed to fetch recent resources");
    }
  },

  async getLibraryResources(_: any, { userId }: { userId: string }) {
    try {
      const user = await User.findById(userId)
        .populate({
          path: "favorite_resources",
          model: "Resource",
          select:
            "_id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
        })
        .exec();

      if (!user) {
        throw new Error("User not found");
      }

      // Transform to include id field
      const favoriteResources = user.favorite_resources || [];
      return favoriteResources.map((resource: any) => ({
        ...(resource.toObject ? resource.toObject() : resource),
        id: resource._id,
      }));
    } catch (error) {
      console.error("Error fetching library resources:", error);
      throw new Error("Failed to fetch library resources");
    }
  },

  async getSuggestedResources(_: any, args: IGetResourcesArgs) {
    try {
      const user = await User.findOne(
        { _id: args.userId },
        {
          favorite_resources: 1,
          recent_resources: 1,
          suggested_resources: 1,
        },
      )
        .populate({
          path: "favorite_resources",
          model: "Resource",
          select:
            "_id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
        })
        .populate({
          path: "recent_resources",
          model: "Resource",
          select:
            "_id contentType title viewsNumber likesNumber sharesNumber subject topic coverImage averageRating createdAt keywords description",
        });

      if (!user) {
        console.warn(`User not found with ID: ${args.userId}`);
        return [];
      }

      const suggestionMap = new Map<
        string,
        {
          resource: IResource;
          reason: string;
          score: number;
        }
      >();

      // Favorited resources
      (user.favorite_resources as unknown as IResource[]).forEach(
        (resource) => {
          if (!suggestionMap.has(resource.id!)) {
            suggestionMap.set(resource.id!, {
              resource,
              reason: "Favorited resource",
              score: 100,
            });
          }
        },
      );

      // Recently visited resources
      (user.recent_resources as unknown as IResource[]).forEach((resource) => {
        if (!suggestionMap.has(resource.id!)) {
          suggestionMap.set(resource.id!, {
            resource,
            reason: "Recently visited",
            score: 50,
          });
        }
      });

      // Suggested categories boost
      const preferredCategories = new Set<string>(
        (user.suggested_resources as unknown as string[]) || [],
      );
      if (preferredCategories.size > 0) {
        suggestionMap.forEach((suggestion) => {
          if (preferredCategories.has(suggestion.resource.contentType!)) {
            suggestion.score += 20;
          }
        });
      }

      // Sort by score
      const sortedSuggestions = Array.from(suggestionMap.values()).sort(
        (a, b) => b.score - a.score,
      );

      // Transform into ResourceSuggestion[]
      return sortedSuggestions.map(({ resource, reason, score }) => ({
        ...resource,
        id: resource.id!,
        reason,
        score,
        resource: {
          id: resource.id!,
          title: resource.title!,
          coverImage: resource.coverImage,
          description: resource.description,
          content: resource.content,
          participants: [], // fill if available
          targetRegion: resource.targetRegion,
          language: resource.language,
          sessionId: resource.sessionId,
          accessKey: resource.accessKey,
          contentType: resource.contentType,
          subject: resource.subject,
          topic: resource.topic,
          keywords: resource.keywords,
          createdBy: {
            id: resource.createdBy || "",
            personalInfo: { username: "" }, // populate if available
            role: "",
          },
          createdAt: resource.createdAt as Date,
        },
      }));
    } catch (error) {
      console.error("Error in getSuggestedResources:", error);
      return [];
    }
  },
};
