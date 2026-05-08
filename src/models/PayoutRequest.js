import mongoose from "mongoose";

const payoutRequestSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    mobile: { type: String, required: true },
    transactionId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currentBalance: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    finalBalance: { type: Number, default: 0 },
    bank: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    holderName: { type: String, required: true },
    debit: { type: Number, default: 0 },
    remark: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
    bankutr: { type: String, default: "" },
    redirectUrl: { type: String, default: "" },
    mode: { type: String, default: "IMPS" },
    utr: { type: String, default: "" },
  },
  { timestamps: true },
);

export const PayoutRequest = mongoose.model("PayoutRequest", payoutRequestSchema);
