import mongoose from "mongoose";

const payinTransactionSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    mobile: { type: String, required: true },
    utr: { type: String, default: "" },
    requestId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    charges: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    callback: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
    paymentLink: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentLink", default: null },
  },
  { timestamps: true },
);

export const PayinTransaction = mongoose.model("PayinTransaction", payinTransactionSchema);
