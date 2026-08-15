import { Router } from "express";
import { nanoid } from "nanoid";
import { pool, touch } from "../db.js";

export const piecesRouter = Router();

// History list — every piece regardless of type, most recently updated first.
piecesRouter.get("/pieces", async (req, res) => {
  const result = await pool.query(
    `SELECT id, type, title, status, created_at, updated_at FROM pieces ORDER BY updated_at DESC`
  );
  res.json(result.rows);
});

// Human review decision — the only place something becomes 'approved' or 'shipped'.
// This matches the flowchart's "Human review — authenticity edit, final judgment"
// -> "Approved?" decision node exactly.
piecesRouter.post("/pieces/:id/review", async (req, res) => {
  const { id } = req.params;
  const { draftId, decision, sentBackTo, notes } = req.body;

  if (!["approved", "sent_back"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'sent_back'" });
  }

  const reviewId = nanoid();
  await pool.query(
    `INSERT INTO reviews (id, piece_id, draft_id, decision, sent_back_to, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [reviewId, id, draftId, decision, sentBackTo || null, notes || null]
  );

  const newStatus = decision === "approved" ? "approved" : (sentBackTo || "needs_revision");
  await pool.query(`UPDATE pieces SET status = $1 WHERE id = $2`, [newStatus, id]);
  await touch(id);

  res.json({ ok: true, newStatus });
});

// Mark shipped — human publishes or presents. Terminal state, matches flowchart END.
piecesRouter.post("/pieces/:id/ship", async (req, res) => {
  const { id } = req.params;
  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });
  if (piece.status !== "approved") {
    return res.status(400).json({ error: "piece must be approved before it can ship" });
  }

  await pool.query(`UPDATE pieces SET status = 'shipped' WHERE id = $1`, [id]);
  await touch(id);
  res.json({ ok: true });
});
