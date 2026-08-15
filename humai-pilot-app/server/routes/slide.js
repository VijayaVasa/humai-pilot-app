import { Router } from "express";
import { nanoid } from "nanoid";
import { pool, touch } from "../db.js";
import { buildStoryline, runSlideQA } from "../claude.js";

export const slideRouter = Router();

// Start a new slide piece. The Slide Agent's interview is shorter (per the
// flowchart) — takeaway, audience, key slide — so we ask these three up front
// rather than one-at-a-time like the Narrative Agent's deeper interview.
const SLIDE_QUESTIONS = [
  "What's the one takeaway this deck needs to land?",
  "Who is the audience, and what do they already know or believe?",
  "Is there a key slide or moment this deck has to build toward?",
];

slideRouter.post("/pieces", async (req, res) => {
  const { sourceNotes, title } = req.body;
  if (!sourceNotes || !sourceNotes.trim()) {
    return res.status(400).json({ error: "sourceNotes is required" });
  }

  const id = nanoid();
  await pool.query(
    `INSERT INTO pieces (id, type, title, status, source_notes)
     VALUES ($1, 'slide', $2, 'interviewing', $3)`,
    [id, title || "(untitled deck)", sourceNotes]
  );

  const turnId = nanoid();
  await pool.query(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES ($1, $2, 0, $3)`,
    [turnId, id, SLIDE_QUESTIONS[0]]
  );

  res.json({ pieceId: id, firstQuestion: SLIDE_QUESTIONS[0], turnId });
});

slideRouter.post("/pieces/:id/answer", async (req, res) => {
  const { id } = req.params;
  const { turnId, answer } = req.body;

  await pool.query(`UPDATE interview_turns SET answer = $1 WHERE id = $2`, [answer, turnId]);
  await touch(id);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS c FROM interview_turns WHERE piece_id = $1 AND answer IS NOT NULL`,
    [id]
  );
  const answeredCount = countResult.rows[0].c;

  if (answeredCount >= SLIDE_QUESTIONS.length) {
    await pool.query(`UPDATE pieces SET status = 'drafting' WHERE id = $1`, [id]);
    return res.json({ readyToDraft: true });
  }

  const newTurnId = nanoid();
  await pool.query(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES ($1, $2, $3, $4)`,
    [newTurnId, id, answeredCount, SLIDE_QUESTIONS[answeredCount]]
  );

  res.json({ readyToDraft: false, nextQuestion: SLIDE_QUESTIONS[answeredCount], turnId: newTurnId });
});

// Build the storyline, then run the automated 11-point QA check.
slideRouter.post("/pieces/:id/draft", async (req, res) => {
  const { id } = req.params;
  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const priorTurnsResult = await pool.query(
    `SELECT question, answer FROM interview_turns WHERE piece_id = $1 ORDER BY turn_index`,
    [id]
  );
  const priorTurns = priorTurnsResult.rows;

  const content = await buildStoryline({ sourceNotes: piece.source_notes, priorTurns });
  const qa = await runSlideQA(content);

  const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM drafts WHERE piece_id = $1`, [id]);
  const version = 1 + countResult.rows[0].c;
  const draftId = nanoid();
  await pool.query(
    `INSERT INTO drafts (id, piece_id, version, content, qa_checklist, passed_automated_check)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [draftId, id, version, content, JSON.stringify(qa.checklist || []), qa.passed ? 1 : 0]
  );

  await pool.query(`UPDATE pieces SET status = $1 WHERE id = $2`, [
    qa.passed ? "in_review" : "needs_revision",
    id,
  ]);
  await touch(id);

  res.json({ draftId, content, qa });
});

slideRouter.get("/pieces/:id", async (req, res) => {
  const { id } = req.params;
  const pieceResult = await pool.query(`SELECT * FROM pieces WHERE id = $1 AND type = 'slide'`, [id]);
  const piece = pieceResult.rows[0];
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const turns = (await pool.query(`SELECT * FROM interview_turns WHERE piece_id = $1 ORDER BY turn_index`, [id])).rows;
  const drafts = (await pool.query(`SELECT * FROM drafts WHERE piece_id = $1 ORDER BY version`, [id])).rows;
  const reviews = (await pool.query(`SELECT * FROM reviews WHERE piece_id = $1 ORDER BY created_at`, [id])).rows;

  res.json({ piece, turns, drafts, reviews });
});
