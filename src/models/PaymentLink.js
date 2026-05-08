import mongoose from "mongoose";

const paymentLinkSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    mobile: { type: String, required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true, index: true },
    utr: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
    deepLink: { type: String, default: "" },
    upiLink: { type: String, default: "" },
    remark: { type: String, default: "" },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
  },
  { timestamps: true },
);

export const PaymentLink = mongoose.model("PaymentLink", paymentLinkSchema);
