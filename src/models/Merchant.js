import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
  {
    merchantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    partnerType: { type: String, default: "Business Partner" },
    email: { type: String, required: true, unique: true, index: true },
    mobile: { type: String, required: true },
    company: { type: String, required: true },
    passwordHash: { type: String, required: true },
    apiToken: { type: String, required: true, unique: true, index: true },
    sessionToken: { type: String, default: null, index: true },
    payinWallet: { type: Number, default: 0 },
    payoutWallet: { type: Number, default: 0 },
    payoutPending: { type: Number, default: 0 },
    payinCallbackUrl: { type: String, default: "" },
    payoutCallbackUrl: { type: String, default: "" },
    authToken: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Merchant = mongoose.model("Merchant", merchantSchema);
