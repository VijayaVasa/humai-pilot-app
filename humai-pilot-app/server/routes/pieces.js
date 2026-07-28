import { Router } from "express";
import { nanoid } from "nanoid";
import { db, touch } from "../db.js";

export const piecesRouter = Router();

// History list — every piece regardless of type, most recently updated first.
piecesRouter.get("/pieces", (req, res) => {
  const rows = db
    .prepare(`SELECT id, type, title, status, created_at, updated_at FROM pieces ORDER BY updated_at DESC`)
    .all();
  res.json(rows);
});

// Human review decision — the only place something becomes 'approved' or 'shipped'.
// This matches the flowchart's "Human review — authenticity edit, final judgment"
// -> "Approved?" decision node exactly.
piecesRouter.post("/pieces/:id/review", (req, res) => {
  const { id } = req.params;
  const { draftId, decision, sentBackTo, notes } = req.body;

  if (!["approved", "sent_back"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'sent_back'" });
  }

  const reviewId = nanoid();
  db.prepare(
    `INSERT INTO reviews (id, piece_id, draft_id, decision, sent_back_to, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(reviewId, id, draftId, decision, sentBackTo || null, notes || null);

  const newStatus = decision === "approved" ? "approved" : (sentBackTo || "needs_revision");
  db.prepare(`UPDATE pieces SET status = ? WHERE id = ?`).run(newStatus, id);
  touch(id);

  res.json({ ok: true, newStatus });
});

// Mark shipped — human publishes or presents. Terminal state, matches flowchart END.
piecesRouter.post("/pieces/:id/ship", (req, res) => {
  const { id } = req.params;
  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ?`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });
  if (piece.status !== "approved") {
    return res.status(400).json({ error: "piece must be approved before it can ship" });
  }

  db.prepare(`UPDATE pieces SET status = 'shipped' WHERE id = ?`).run(id);
  touch(id);
  res.json({ ok: true });
});
