import express from "express";
import cors from "cors";
import "dotenv/config";
import "./db.js"; // ensures tables exist on boot

import { narrativeRouter } from "./routes/narrative.js";
import { slideRouter } from "./routes/slide.js";
import { piecesRouter } from "./routes/pieces.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/narrative", narrativeRouter);
app.use("/api/slide", slideRouter);
app.use("/api", piecesRouter); // /api/pieces (history), /api/pieces/:id/review, /ship

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`HUMAI pilot backend listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set — agent calls will fail. Copy .env.example to .env and fill it in.");
  }
});
