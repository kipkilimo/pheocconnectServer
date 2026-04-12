// paymentTypeDefs.ts
import { gql } from "apollo-server-express";

export const paymentTypeDefs = gql`
  type Payment {
    _id: ID!
    userId: User!
    paidAmount: String
    departmentId: String
    discussionGroupId: String
    transactionEntity: String
    paymentPhoneNumber: String
    transactionReferenceNumber: String
    paymentMethod: String
    createdAt: String!
  }

  type Mutation {
    # Mutation for waiving the access fee via WAIVER
    publicationCreditsPaymentViaWaiver(
      userId: String!
      discussionGroupId: String!
    ): Payment

    # Mutation for making access payment via MPESA
    publicationCreditsPaymentViaMpesa(
      userId: String!
      departmentId: String
      discussionGroupId: String
      paidAmount: String!
      transactionEntity: String
      paymentPhoneNumber: String!
      transactionReferenceNumber: String
      paymentMethod: String
      createdAt: String
    ): Payment

    # Mutation for making access payment via PayPal
    publicationCreditsPaymentViaPaypal(
      userId: String!
      paidAmount: String!
      departmentId: String
      discussionGroupId: String
      transactionEntity: String!
      paymentPhoneNumber: String
      transactionReferenceNumber: String
      paymentMethod: String
      createdAt: String
    ): Payment

    # Mutation for making access payment via MPESA Donation
    processMpesaDonation(
      userId: String
      departmentId: String
      discussionGroupId: String
      paidAmount: String!
      transactionEntity: String
      paymentPhoneNumber: String!
      transactionReferenceNumber: String
      paymentMethod: String
      createdAt: String
    ): Payment

    # Mutation for making access payment via PayPal Donation
    processPaypalDonation(
      userId: String
      paidAmount: String!
      departmentId: String
      discussionGroupId: String
      transactionEntity: String
      paymentPhoneNumber: String
      transactionReferenceNumber: String!
      paymentMethod: String
      createdAt: String
    ): Payment

    processMpesaSubscriptionPayment(
      userId: String!
      paidAmount: String!
      paymentPhoneNumber: String!
    ): Payment
    premiumAccessPaymentViaMpesa(
      userId: String!
      paidAmount: String!
      paymentPhoneNumber: String!
    ): Payment

    premiumAccessPaymentViaPaypal(
      userId: String!
      transactionReferenceNumber: String!
      paidAmount: String!
    ): Payment

    consultationPaymentViaMpesa(
      userId: String!
      consultationId: String!
      paidAmount: String!
      paymentPhoneNumber: String!
    ): Payment

    consultationPaymentViaPaypal(
      userId: String!
      consultationId: String!
      transactionReferenceNumber: String!
      paidAmount: String!
    ): Payment

    # Mutation to process subscription payment via PayPal
    processPaypalSubscriptionPayment(
      userId: String!
      paidAmount: String!
    ): Payment
  }

  type Query {
    getPayment(paymentId: ID!): Payment!
    getPayments: [Payment]
    getDonatedPayments: [Payment]
  }
`;

export default paymentTypeDefs;
