import mongoose, { Schema, Document } from "mongoose";

// Interface for the Payment model
interface Payment extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  departmentId: string;
  discussionGroupId: string;
  transactionReferenceNumber: string;
  transactionEntity: string;
  paymentPhoneNumber: string;
  paidAmount: string;
  paymentMethod: string;
  invoice_payment_channel:
    | "PAYPAL"
    | "WAIVER"
    | "VISA"
    | "MPESA"
    | "EQUITY"
    | "MASTERCARD"
    | "OTHER";
  createdAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    departmentId: {
      type: String,
    },
    discussionGroupId: {
      type: String,
    },
    transactionReferenceNumber: {
      type: String,
    },
    transactionEntity: {
      type: String,
    },
    paymentPhoneNumber: {
      type: String,
    },
    paidAmount: {
      type: String,
    },
    invoice_payment_channel: {
      type: String,
      enum: [
        "PAYPAL",
        "WAIVER",
        "VISA",
        "MPESA",
        "EQUITY",
        "MASTERCARD",
        "OTHER",
      ],
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Export the Payment model
const Payment = mongoose.model<Payment>("Payment", PaymentSchema);
export default Payment;
