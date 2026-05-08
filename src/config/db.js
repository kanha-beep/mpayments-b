import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/payment_dashboard";
  await mongoose.connect(mongoUri);
  return mongoUri;
}
