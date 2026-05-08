import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "merchant_admin" },
    sessionToken: { type: String, default: null, index: true },
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
