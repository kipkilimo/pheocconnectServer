import { IVendor } from "../../models/Vendor";
import Vendor from "../../models/Vendor";

const vendorResolver = {
  Mutation: {
    // Mutation to create a new vendor
    async createVendor(_: any, { vendorId, vendorPin }: IVendor) {
      try {
        console.log({ vendorId, vendorPin });

        // Create a new vendor document
        const vendor = new Vendor({
          vendorId,
          vendorPin,
        });

        // Save the new vendor document to the database
        await vendor.save();

        // Return the created vendor document
        return vendor;
      } catch (error) {
        console.error("Error creating vendor:", error);
        throw new Error("Failed to create vendor");
      }
    },

    // Mutation to update an existing vendor by ID
    async updateVendor(
      _: any,
      {
        id,
        vendorId,
        vendorPin,
      }: { id: string; vendorId?: string; vendorPin?: number },
    ) {
      try {
        // Log the update data for debugging
        console.log({ id, vendorId, vendorPin });

        // Find the vendor by ID and update the specified fields
        const vendor = await Vendor.findByIdAndUpdate(
          id,
          {
            ...(vendorId && { vendorId }),
            ...(vendorPin && { vendorPin }),
          },
          { new: true, runValidators: true }, // Return the updated document and run validation
        );

        // Check if the vendor was found and updated
        if (!vendor) {
          throw new Error("Vendor not found");
        }

        return vendor;
      } catch (error) {
        console.error("Error updating vendor:", error);
        throw new Error("Failed to update vendor");
      }
    },

    // Mutation to delete a vendor by ID
    async deleteVendor(_: any, { id }: { id: string }) {
      try {
        console.log({ id });

        // Find the vendor by ID and delete it
        const vendor = await Vendor.findByIdAndDelete(id);

        // Check if the vendor was found and deleted
        if (!vendor) {
          throw new Error("Vendor not found");
        }

        return vendor;
      } catch (error) {
        console.error("Error deleting vendor:", error);
        throw new Error("Failed to delete vendor");
      }
    },
  },
};

export default vendorResolver;
