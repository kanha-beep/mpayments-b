import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    mobile: { type: String, default: "" },
    reference: { type: String, required: true },
    traceId: { type: String, required: true },
    startBal: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    endBal: { type: Number, default: 0 },
    bank: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    remark: { type: String, default: "" },
    webhook: { type: String, default: "" },
    state: { type: String, enum: ["Pending", "Success", "Failed"], default: "Success" },
  },
  { timestamps: true },
);

export const Settlement = mongoose.model("Settlement", settlementSchema);
