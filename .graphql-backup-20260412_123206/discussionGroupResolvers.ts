import { IResolvers } from "@graphql-tools/utils";
import DiscussionGroup, {
  IDiscussionGroup,
} from "../../models/DiscussionGroup"; // Ensure this is the correct model and interface
import User from "../../models/User"; // Assuming User type is imported
import { generateUniqueCode } from "../../utils/identifier_generator";
import generateAccessKey from "../../utils/accessKeyUtility";

const resolvers: IResolvers = {
  Query: {
    // Fetch a specific discussion group by ID
    getDiscussionGroup: async (
      _parent,
      args: { discussionGroupId: string },
    ): Promise<IDiscussionGroup | null> => {
      const group = await DiscussionGroup.findOne({
        discussionGroupId: args.discussionGroupId,
      }).populate("members"); // Ensure these are valid fields

      if (!group) {
        throw new Error("Discussion group not found");
      }

      return group;
    },

    // Fetch all discussion groups
    getDiscussionGroups: async (): Promise<IDiscussionGroup[]> => {
      return await DiscussionGroup.find().populate("members"); // Populate members and
    },
  },

  Mutation: {
    // Create a new discussion group
    createDiscussionGroup: async (
      _parent,
      args: {
        createdBy: string;
        name: string;
        program: string;
        members: string[]; // Array of member emails
      },
    ): Promise<IDiscussionGroup> => {
      try {
        const memberEmails = args.members;

        console.log("memberEmails:", memberEmails);
        // Fetch user IDs based on provided emails
        const memberUsers = await Promise.all(
          memberEmails.map(async (email) => {
            const member = await User.findOne({ "personalInfo.email": email });
            return member ? member._id : null; // Return ObjectId or null
          }),
        );
        const validMembers = memberUsers.filter((member) => member !== null);

        // Ensure there are at least 2 valid members
        if (validMembers.length < 2) {
          throw new Error(
            "At least 2 valid members are required to create a discussion group.",
          );
        }

        // Create the new discussion group
        const newGroup = await new DiscussionGroup({
          discussionGroupId: generateUniqueCode(12), // Assuming this generates a unique 12-char ID
          createdBy: args.createdBy,
          name: args.name,
          members: validMembers,
          program: args.program,
        }).save(); // await the save operation

        console.log("newGroup:", newGroup);

        // Find the user by createdBy
        const user = await User.findById(args.createdBy);
        if (!user) {
          throw new Error("User not found.");
        }

        // Initialize discussion_groups if it doesn't exist
        user.discussion_groups = user.discussion_groups || []; // Ensure it's an array

        // Add the new group's ID to the user's discussion_groups field
        // @ts-ignore
        user.discussion_groups.push(newGroup._id); // Use _id for the ObjectId

        // Save the updated user
        await user.save();

        return newGroup;
      } catch (error) {
        console.error("Error creating discussion group:", error);
        throw new Error("Failed to create discussion group");
      }
    },
    // Update an existing discussion group
    //   updateDiscussionGroup(
    // discussionGroupId: $discussionGroupId
    // name: $name
    // program: $program
    // members: $members

    updateDiscussionGroup: async (
      _parent,
      args: {
        discussionGroupId: string;
        name: string;
        program: string;
        members: string[]; // Array of member emails
      },
    ): Promise<IDiscussionGroup | null> => {
      const group = await DiscussionGroup.findOne({
        discussionGroupId: args.discussionGroupId,
      });

      if (!group) {
        throw new Error("Discussion group not found");
      }

      if (args.name.length > 2) {
        group.name = args.name;
      }
      if (args.program.length > 2) {
        // @ts-ignore
        group.program = args.program;
      }

      const memberEmails = args.members;

      console.log("memberEmails:", memberEmails);
      // Fetch user IDs based on provided emails
      const memberUsers = await Promise.all(
        memberEmails.map(async (email) => {
          const member = await User.findOne({ "personalInfo.email": email });
          return member ? member._id : null; // Return ObjectId or null
        }),
      );
      const validMembers = memberUsers.filter((member) => member !== null);

      // Ensure there are at least 2 valid members
      if (validMembers.length < 2) {
        throw new Error(
          "At least 2 valid members are required to create a discussion group.",
        );
      }
      group.members = validMembers;
      await group.save();
      return group;
    },

    // Delete a discussion group
    deleteDiscussionGroup: async (
      _parent,
      args: { discussionGroupId: string },
    ): Promise<IDiscussionGroup | null> => {
      const group = await DiscussionGroup.findOneAndDelete({
        discussionGroupId: args.discussionGroupId,
      });

      if (!group) {
        throw new Error("Discussion group not found");
      }

      return group;
    },
  },
};

export default resolvers;
