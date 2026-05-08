import mongoose from "mongoose";

const walletTransferSchema = new mongoose.Schema(
  {
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    customer: { type: String, required: true },
    transactionType: { type: String, enum: ["credit", "debit"], default: "credit" },
    openingPayin: { type: Number, default: 0 },
    openingPayout: { type: Number, default: 0 },
    amountCredited: { type: Number, default: 0 },
    amountDebited: { type: Number, default: 0 },
    closingPayin: { type: Number, default: 0 },
    closingPayout: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const WalletTransfer = mongoose.model("WalletTransfer", walletTransferSchema);
