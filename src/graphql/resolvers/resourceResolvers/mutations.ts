import Resource from "../../../models/Resource";
import User from "../../../models/User";
import { generateUniqueCode } from "../../../utils/identifier_generator";
import generateAccessKey from "../../../utils/accessKeyUtility";
import { IResource } from "./types";
import { getCreditsByResourceType } from "./utils";

export const resourceMutations = {
  async togglePublicationStatus(
    _: any,
    {
      resourceId,
      resourceStatus,
    }: { resourceId: string; resourceStatus: string },
  ) {
    try {
      const resource = await Resource.findById(resourceId);

      if (!resource) {
        throw new Error("Resource not found");
      }

      resource.isPublished = resourceStatus === "Publish";
      await resource.save();

      return resource;
    } catch (error) {
      console.error("Error updating resource:", error);
      throw new Error("Failed to update resource");
    }
  },

  async createResource(
    _: any,
    {
      title,
      description,
      targetRegion,
      targetCountry,
      language,
      subject,
      keywords,
      topic,
      contentType,
      createdBy,
    }: IResource,
  ) {
    try {
      const sessionIdStr = generateUniqueCode(11);
      const accessKeyStr = generateAccessKey();

      const resource = new Resource({
        title,
        description,
        targetRegion,
        subject,
        topic,
        targetCountry,
        language,
        keywords,
        contentType,
        sessionId: sessionIdStr,
        accessKey: accessKeyStr,
        createdBy,
      });

      const currentPublisher = await User.findById(createdBy);
      if (!currentPublisher) {
        throw new Error("No teacher matching provided details");
      }

      const creditsToLess = getCreditsByResourceType(contentType || "");
      const newCredit =
        Number(currentPublisher.personalInfo.publication_credits) -
        creditsToLess;

      await User.findByIdAndUpdate(currentPublisher.id, {
        $set: {
          publication_credits: newCredit,
        },
      });

      await resource.save();
      return resource;
    } catch (error) {
      console.error("Error creating resource:", error);
      throw new Error("Failed to create resource");
    }
  },

  async addResourceFormContent(
    _: any,
    { resourceDetails }: { resourceDetails: string },
  ) {
    try {
      const paramsArray = JSON.parse(resourceDetails);
      const params = paramsArray[0];
      console.log({ params });
      const { resourceId, resourceContent, createdBy } = params;

      // Parse resourceContent if it's a string
      let parsedContent;
      try {
        parsedContent =
          typeof resourceContent === "string"
            ? JSON.parse(resourceContent)
            : resourceContent;
      } catch (e) {
        parsedContent = resourceContent;
      }

      // If no resourceId, create a new resource
      if (!resourceId) {
        // Extract title from parsedContent or use default
        const title = parsedContent?.topic;

        // Handle language: strip COMPUTING- prefix if present
        let language = parsedContent?.language || "";
        if (language.startsWith("COMPUTING-")) {
          language = language.replace("COMPUTING-", "");
        }

        const sessionIdStr = generateUniqueCode(11);
        const accessKeyStr = generateAccessKey();

        // Get content type - default to COMPUTING
        const contentType = "COMPUTING";

        // Get credits and validate user
        const currentPublisher = await User.findById(createdBy);
        if (!currentPublisher) {
          throw new Error("No teacher matching provided details");
        }

        const creditsToLess = getCreditsByResourceType(contentType);
        const newCredit =
          Number(currentPublisher.personalInfo.publication_credits) -
          creditsToLess;

        if (newCredit < 0) {
          throw new Error("Insufficient publication credits");
        }

        await User.findByIdAndUpdate(currentPublisher.id, {
          $set: {
            publication_credits: newCredit,
          },
        });

        // Create new resource
        const resource = new Resource({
          title,
          description:
            parsedContent?.description || "Resource created from form content",
          targetRegion: parsedContent?.targetRegion || "",
          subject: parsedContent?.subject || "",
          topic: parsedContent?.articleTopic || "",
          targetCountry: parsedContent?.targetCountry || "",
          language: language,
          keywords: parsedContent?.keywords || "",
          contentType: contentType,
          sessionId: sessionIdStr,
          accessKey: accessKeyStr,
          createdBy,
          content: JSON.stringify([resourceContent]),
          metaInfo: "",
        });

        await resource.save();
        return resource;
      }

      // Update existing resource - validate resourceId is valid MongoDB ObjectId

      // Find the resource
      const resource = await Resource.findById(resourceId);
      if (!resource) {
        throw new Error(`Resource not found with ID: ${resourceId}`);
      }

      // Optional: Verify that the current user has permission to update this resource
      if (resource.createdBy?.toString() !== createdBy?.toString()) {
        throw new Error("You don't have permission to update this resource");
      }

      // Handle language stripping for existing resource
      let finalLanguage = resource.language || "";
      if (
        parsedContent?.language &&
        parsedContent.language.startsWith("COMPUTING-")
      ) {
        finalLanguage = parsedContent.language.replace("COMPUTING-", "");
        resource.language = finalLanguage;
      }

      // Update content based on type
      if (resource.contentType === "POSTER") {
        console.log({ metaInfo: JSON.stringify([resourceContent]) });
        resource.metaInfo = JSON.stringify([resourceContent]);
      } else {
        resource.content = JSON.stringify([resourceContent]);
      }

      // Optional: Update other fields if needed
      if (parsedContent?.title) {
        resource.title = parsedContent.title;
      }
      if (parsedContent?.description) {
        resource.description = parsedContent.description;
      }

      await resource.save();
      return resource;
    } catch (error) {
      console.error("Error in addResourceFormContent:", error);

      // Throw more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("Resource not found")) {
          throw new Error(error.message);
        }
        if (error.message.includes("Invalid resource ID format")) {
          throw new Error(error.message);
        }
        if (error.message.includes("permission")) {
          throw new Error(error.message);
        }
      }

      throw new Error(
        `Failed to write resource: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },

  async updateResource(
    _: any,
    {
      id,
      title,
      description,
      content,
      targetRegion,
      subject,
      topic,
      targetCountry,
      slug,
      language,
      contentType,
      viewsNumber,
      likesNumber,
      sharesNumber,
      rating,
      sessionId,
      accessKey,
      keywords,
      coverImage,
      isPublished,
      averageRating,
      reviews,
    }: IResource,
  ) {
    try {
      const updatedResource = await Resource.findByIdAndUpdate(
        id,
        {
          ...(title && { title }),
          ...(description && { description }),
          ...(content && { content }),
          ...(targetRegion && { targetRegion }),
          ...(targetCountry && { targetCountry }),
          ...(slug && { slug }),
          ...(subject && { subject }),
          ...(topic && { topic }),
          ...(language && { language }),
          ...(contentType && { contentType }),
          ...(viewsNumber !== undefined && { viewsNumber }),
          ...(likesNumber !== undefined && { likesNumber }),
          ...(sharesNumber !== undefined && { sharesNumber }),
          ...(rating && { rating }),
          ...(sessionId && { sessionId }),
          ...(accessKey && { accessKey }),
          ...(keywords && { keywords }),
          ...(coverImage && { coverImage }),
          ...(isPublished !== undefined && { isPublished }),
          ...(averageRating !== undefined && { averageRating }),
          ...(reviews && { reviews }),
        },
        { new: true, runValidators: true },
      );

      if (!updatedResource) {
        throw new Error("Resource not found");
      }

      return updatedResource;
    } catch (error) {
      console.error("Error updating resource:", error);
      throw new Error("Failed to update resource");
    }
  },

  async deleteResource(_: any, { id }: { id: string }) {
    const resource = await Resource.findByIdAndDelete(id);
    return resource;
  },
};
