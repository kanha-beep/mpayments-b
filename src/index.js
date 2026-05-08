import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import internalRoutes from "./routes/internalRoutes.js";
import externalApiRoutes from "./routes/externalApiRoutes.js";
import { connectDatabase } from "./config/db.js";
import { seedDatabase } from "./services/seedService.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "payment-dashboard-api", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api", internalRoutes);
app.use("/API", externalApiRoutes);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || "Internal server error" });
});

async function start() {
  const mongoUri = await connectDatabase();
  await seedDatabase();
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Mongo connected: ${mongoUri}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
