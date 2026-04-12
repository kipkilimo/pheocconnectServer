import mongoose, { Schema, Document } from "mongoose";

// Define the Vendor interface that extends Document
export interface IVendor extends Document {
  vendorId: string;
  vendorPin: number;
}

// Create the Vendor schema
const VendorSchema: Schema = new Schema({
  vendorId: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v: string) {
        return /^[a-zA-Z0-9]{19}$/.test(v); // Ensure it's a 19-character alphanumeric string
      },
      message: (props: any) => `${props.value} is not a valid vendorId!`,
    },
  },
  vendorPin: {
    type: String,
    required: true,
    validate: {
      validator: function (v: number) {
        return /^[0-9]{4}$/.test(v.toString()); // Ensure it's a 4-digit number
      },
      message: (props: any) => `${props.value} is not a valid 4-digit PIN!`,
    },
  },
});

// Create and export the Vendor model
const Vendor = mongoose.model<IVendor>("Vendor", VendorSchema);
export default Vendor;
