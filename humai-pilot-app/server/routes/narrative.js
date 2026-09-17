import { Router } from "express";
import { nanoid } from "nanoid";
import { pool, touch } from "../db.js";
import {
  synthesizeSource,
  nextInterviewQuestion,
  draftNarrative,
  critiqueNarrative,
} from "../claude.js";

export const narrativeRouter = Router();

// Start a new narrative piece: submit rough input, get the synthesis + first question.
narrativeRouter.post("/pieces", async (req, res) => {
  const { sourceNotes, title, createdBy } = req.body;
  if (!sourceNotes || !sourceNotes.trim()) {
    return res.status(400).json({ error: "sourceNotes is required" });
  }
  if (!createdBy || !createdBy.trim()) {
    return res.status(400).json({ error: "createdBy (your name) is required" });
  }

  const id = nanoid();
  const synthesis = await synthesizeSource(sourceNotes);

  await pool.query(
    `INSERT INTO pieces (id, type, title, created_by, status, source_notes, synthesis)
     VALUES ($1, 'narrative', $2, $3, 'interviewing', $4, $5)`,
    [id, title || "(untitled narrative piece)", createdBy.trim(), sourceNotes, synthesis]
  );

  const firstQuestion = await nextInterviewQuestion({
    sourceNotes,
    synthesis,
    priorTurns: [],
  });

  const turnId = nanoid();
  await pool.query(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES ($1, $2, 0, $3)`,
    [turnId, id, firstQuestion]
  );

  res.json({ pieceId: id, synthesis, firstQuestion, turnId });
});

// Answer the current question, get the next one (or READY_TO_DRAFT).
narrativeRouter.post("/pieces/:id/answer", async (req, res) => {
  const { id } = req.params;
  const { turnId, answer } = req.body;

  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });

  await pool.query(`UPDATE interview_turns SET answer = $1 WHERE id = $2`, [answer, turnId]);
  await touch(id);

  const priorTurnsResult = await pool.query(
    `SELECT question, answer FROM interview_turns WHERE piece_id = $1 ORDER BY turn_index`,
    [id]
  );
  const priorTurns = priorTurnsResult.rows;

  const nextQ = await nextInterviewQuestion({
    sourceNotes: piece.source_notes,
    synthesis: piece.synthesis,
    priorTurns,
  });

  // Matches even if the model adds reflection/commentary before the signal —
  // don't require an exact string match on the whole response.
  if (nextQ.includes("READY_TO_DRAFT")) {
    await pool.query(`UPDATE pieces SET status = 'drafting' WHERE id = $1`, [id]);
    return res.json({ readyToDraft: true });
  }

  const nextIndex = priorTurns.length;
  const newTurnId = nanoid();
  await pool.query(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES ($1, $2, $3, $4)`,
    [newTurnId, id, nextIndex, nextQ]
  );

  res.json({ readyToDraft: false, nextQuestion: nextQ, turnId: newTurnId });
});

// Person can also skip ahead early, per the skill file's "respect the skip" rule.
narrativeRouter.post("/pieces/:id/skip-to-draft", async (req, res) => {
  const { id } = req.params;
  await pool.query(`UPDATE pieces SET status = 'drafting' WHERE id = $1`, [id]);
  res.json({ ok: true });
});

// Draft the article, then immediately run the critique agent (the two-agent loop).
narrativeRouter.post("/pieces/:id/draft", async (req, res) => {
  const { id } = req.params;
  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const priorTurnsResult = await pool.query(
    `SELECT question, answer FROM interview_turns WHERE piece_id = $1 ORDER BY turn_index`,
    [id]
  );
  const priorTurns = priorTurnsResult.rows;

  const content = await draftNarrative({
    sourceNotes: piece.source_notes,
    synthesis: piece.synthesis,
    priorTurns,
  });
  const critique = await critiqueNarrative(content);

  const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM drafts WHERE piece_id = $1`, [id]);
  const version = 1 + countResult.rows[0].c;
  const draftId = nanoid();
  await pool.query(
    `INSERT INTO drafts (id, piece_id, version, content, critique_flags, passed_automated_check)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [draftId, id, version, content, JSON.stringify(critique.flags || []), critique.issuesFound ? 0 : 1]
  );

  await pool.query(`UPDATE pieces SET status = $1 WHERE id = $2`, [
    critique.issuesFound ? "needs_revision" : "in_review",
    id,
  ]);
  await touch(id);

  res.json({ draftId, content, critique });
});

narrativeRouter.get("/pieces/:id", async (req, res) => {
  const { id } = req.params;
  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1 AND type = 'narrative'`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const turns = (await pool.query(`SELECT * FROM interview_turns WHERE piece_id = $1 ORDER BY turn_index`, [id])).rows;
  const drafts = (await pool.query(`SELECT * FROM drafts WHERE piece_id = $1 ORDER BY version`, [id])).rows;
  const reviews = (await pool.query(`SELECT * FROM reviews WHERE piece_id = $1 ORDER BY created_at`, [id])).rows;

  res.json({ piece, turns, drafts, reviews });
});
