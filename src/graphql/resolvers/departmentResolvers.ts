import { IResolvers } from "@graphql-tools/utils";
import Department, { IDepartment } from "../../models/Department"; // Ensure this is the correct model and interface
import User from "../../models/User"; // Assuming User type is imported

// Utility function to find a department by its departmentId
const findDepartmentById = async (
  departmentId: string,
): Promise<IDepartment | null> => {
  return await Department.findOne({ departmentId }).populate(
    "faculty programs students",
  );
};

const resolvers: IResolvers = {
  Query: {
    getDepartment: async (
      _parent,
      args: { departmentId: string },
    ): Promise<IDepartment | null> => {
      const department = await findDepartmentById(args.departmentId);
      if (!department) {
        throw new Error("Department not found");
      }
      return department;
    },
    getDepartments: async (): Promise<IDepartment[]> => {
      return await Department.find().populate("faculty programs students"); // Return all departments
    },
  },
  Mutation: {
    createADepartment: async (
      _parent,
      args: {
        departmentId: string;
        name: string;
        parent_institution: string;
        phone_number: string;
        email_address: string;
        createdBy: string;
        members: string[]; // Array of member emails
      },
    ): Promise<IDepartment> => {
      try {
        // Check if department already exists
        const existingDepartment = await findDepartmentById(args.departmentId);
        if (existingDepartment) {
          throw new Error("Department already exists");
        }

        // Validate members
        const memberEmails = args.members;
        const memberUsers = await Promise.all(
          memberEmails.map(async (email) => {
            const member = await User.findOne({ "personalInfo.email": email });
            return member ? member._id : null; // Return ObjectId or null
          }),
        );
        const validMembers = memberUsers.filter((member) => member !== null);

        // Ensure there are at least 2 valid members (if needed)
        if (validMembers.length < 2) {
          throw new Error(
            "At least 2 valid members are required to create a department.",
          );
        }

        // Create new department
        const newDepartment = new Department({
          departmentId: args.departmentId,
          name: args.name,
          createdBy: args.createdBy,
          parent_institution: args.parent_institution,
          phone_number: args.phone_number,
          email_address: args.email_address,
          faculty: validMembers, // Set the valid members as the department's faculty
          programs: [], // Initialize with empty programs array
          students: [], // Initialize with empty students array
        });

        // Save new department to the database
        await newDepartment.save();
        console.log("New department created:", newDepartment);

        // Find the user who created the department
        const user = await User.findById(args.createdBy);
        if (!user) {
          throw new Error("User not found.");
        }

        // Initialize the user's departments field if it doesn't exist
        user.departments = user.departments || [];

        // Add the new department's ID to the user's departments
        // @ts-ignore
        user.departments.push(newDepartment._id);

        // Save the updated user
        await user.save();

        return newDepartment;
      } catch (error) {
        console.error("Error creating department:", error);
        throw new Error("Failed to create department");
      }
    },

    updateDepartment: async (
      _parent,
      args: {
        departmentId: string;
        name?: string;
        parent_institution?: string;
        phone_number?: string;
        email_address?: string;
        membershipUpdate: string; // 'STUDENT', 'FACULTY', 'ASSISTANT'
        members: string[]; // Array of member emails
      },
    ): Promise<IDepartment> => {
      try {
        // Check if the department exists
        const department = await findDepartmentById(args.departmentId);
        if (!department) {
          throw new Error("Department not found.");
        }

        // Validate and fetch members
        const memberEmails = args.members;
        const memberUsers = await Promise.all(
          memberEmails.map(async (email) => {
            const member = await User.findOne({ "personalInfo.email": email });
            return member ? member._id : null; // Return ObjectId or null
          }),
        );
        const validMembers = memberUsers.filter((member) => member !== null);

        // Ensure there are at least 1 valid members (if needed)
        if (validMembers.length < 1) {
          throw new Error(
            "At least 1 valid members are required to update a department.",
          );
        }

        // Set the role based on the membershipUpdate argument
        const updatedMembers = await Promise.all(
          validMembers.map(async (memberId) => {
            const user = await User.findById(memberId);
            if (!user) {
              throw new Error("User not found.");
            }

            // Set role based on membershipUpdate
            let role = "FACULTY"; // Default role
            if (args.membershipUpdate === "STUDENT") {
              role = "STUDENT";
            } else if (args.membershipUpdate === "ASSISTANT") {
              role = "ASSISTANT";
            }

            // Update the user's role
            // @ts-ignore
            user.role = role;
            await user.save();
            return user;
          }),
        );

        // Update department fields only if provided and non-empty
        if (args.name && args.name !== "") {
          department.name = args.name;
        }
        if (args.parent_institution && args.parent_institution !== "") {
          department.parent_institution = args.parent_institution;
        }
        if (args.phone_number && args.phone_number !== "") {
          department.phone_number = args.phone_number;
        }
        if (args.email_address && args.email_address !== "") {
          department.email_address = args.email_address;
        }

        // Assign members based on their roles
        // Assign members based on their roles, ensuring uniqueness by email and role
        if (args.membershipUpdate === "STUDENT") {
          // Filter out duplicates by checking existing students' emails
          const existingStudentEmails = department.students.map((studentId) => {
            const student = updatedMembers.find((member) =>
              member._id.equals(studentId),
            );
            return student ? student.personalInfo.email : null;
          });

          const newStudents = updatedMembers.filter(
            (member) =>
              !existingStudentEmails.includes(member.personalInfo.email),
          );

          // Push new students into the department's students array without duplicates
          department.students = [
            ...department.students,
            ...newStudents.map((member) => member._id),
          ];
        } else {
          // Filter out duplicates by checking existing faculty members' emails
          const existingFacultyEmails = department.faculty.map((facultyId) => {
            const faculty = updatedMembers.find((member) =>
              member._id.equals(facultyId),
            );
            return faculty ? faculty.personalInfo.email : null;
          });

          const newFaculty = updatedMembers.filter(
            (member) =>
              !existingFacultyEmails.includes(member.personalInfo.email),
          );

          // Push new faculty or assistants into the department's faculty array without duplicates
          department.faculty = [
            ...department.faculty,
            ...newFaculty.map((member) => member._id),
          ];
        }

        // Save updated department to the database
        await department.save();
        console.log("Department updated:", department);

        return department;
      } catch (error) {
        console.error("Error updating department:", error);
        throw new Error("Failed to update department");
      }
    },
    deleteDepartment: async (
      _parent,
      args: { departmentId: string },
    ): Promise<IDepartment | null> => {
      const department = await Department.findOneAndDelete({
        departmentId: args.departmentId,
      });
      if (!department) {
        throw new Error("Department not found");
      }

      return department; // Return the deleted department
    },
  },
};

export default resolvers;
