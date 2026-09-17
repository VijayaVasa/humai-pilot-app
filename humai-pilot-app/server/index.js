import express from "express";
import cors from "cors";
import "dotenv/config";
import { initDb } from "./db.js";

import { narrativeRouter } from "./routes/narrative.js";
import { slideRouter } from "./routes/slide.js";
import { piecesRouter } from "./routes/pieces.js";
import { uploadRouter } from "./routes/upload.js";

const app = express();
// FRONTEND_URL should be set on Render once you have your Vercel URL, e.g.
// https://humai-pilot-app.vercel.app — restricts the API to your deployed frontend.
// Left unset, CORS stays open, which is fine for local dev only.
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/narrative", narrativeRouter);
app.use("/api/slide", slideRouter);
app.use("/api", piecesRouter); // /api/pieces (history), /api/pieces/:id/review, /ship
app.use("/api", uploadRouter); // /api/extract-text

const PORT = process.env.PORT || 8787;

async function start() {
  if (!process.env.DATABASE_URL) {
    console.warn("WARNING: DATABASE_URL is not set — the app cannot connect to Postgres. See README for Render Postgres setup.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set — agent calls will fail. Copy .env.example to .env and fill it in.");
  }
  await initDb();
  app.listen(PORT, () => {
    console.log(`HUMAI pilot backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
