import { Router } from "express";
import { nanoid } from "nanoid";
import { db, touch } from "../db.js";
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

slideRouter.post("/pieces", (req, res) => {
  const { sourceNotes, title } = req.body;
  if (!sourceNotes || !sourceNotes.trim()) {
    return res.status(400).json({ error: "sourceNotes is required" });
  }

  const id = nanoid();
  db.prepare(
    `INSERT INTO pieces (id, type, title, status, source_notes)
     VALUES (?, 'slide', ?, 'interviewing', ?)`
  ).run(id, title || "(untitled deck)", sourceNotes);

  const turnId = nanoid();
  db.prepare(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES (?, ?, 0, ?)`
  ).run(turnId, id, SLIDE_QUESTIONS[0]);

  res.json({ pieceId: id, firstQuestion: SLIDE_QUESTIONS[0], turnId });
});

slideRouter.post("/pieces/:id/answer", (req, res) => {
  const { id } = req.params;
  const { turnId, answer } = req.body;

  db.prepare(`UPDATE interview_turns SET answer = ? WHERE id = ?`).run(answer, turnId);
  touch(id);

  const answeredCount = db
    .prepare(`SELECT COUNT(*) c FROM interview_turns WHERE piece_id = ? AND answer IS NOT NULL`)
    .get(id).c;

  if (answeredCount >= SLIDE_QUESTIONS.length) {
    db.prepare(`UPDATE pieces SET status = 'drafting' WHERE id = ?`).run(id);
    return res.json({ readyToDraft: true });
  }

  const newTurnId = nanoid();
  db.prepare(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES (?, ?, ?, ?)`
  ).run(newTurnId, id, answeredCount, SLIDE_QUESTIONS[answeredCount]);

  res.json({ readyToDraft: false, nextQuestion: SLIDE_QUESTIONS[answeredCount], turnId: newTurnId });
});

// Build the storyline, then run the automated 11-point QA check.
slideRouter.post("/pieces/:id/draft", async (req, res) => {
  const { id } = req.params;
  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ?`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const priorTurns = db
    .prepare(`SELECT question, answer FROM interview_turns WHERE piece_id = ? ORDER BY turn_index`)
    .all(id);

  const content = await buildStoryline({ sourceNotes: piece.source_notes, priorTurns });
  const qa = await runSlideQA(content);

  const version = 1 + (db.prepare(`SELECT COUNT(*) c FROM drafts WHERE piece_id = ?`).get(id).c);
  const draftId = nanoid();
  db.prepare(
    `INSERT INTO drafts (id, piece_id, version, content, qa_checklist, passed_automated_check)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(draftId, id, version, content, JSON.stringify(qa.checklist || []), qa.passed ? 1 : 0);

  db.prepare(`UPDATE pieces SET status = ? WHERE id = ?`).run(
    qa.passed ? "in_review" : "needs_revision",
    id
  );
  touch(id);

  res.json({ draftId, content, qa });
});

slideRouter.get("/pieces/:id", (req, res) => {
  const { id } = req.params;
  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ? AND type = 'slide'`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const turns = db.prepare(`SELECT * FROM interview_turns WHERE piece_id = ? ORDER BY turn_index`).all(id);
  const drafts = db.prepare(`SELECT * FROM drafts WHERE piece_id = ? ORDER BY version`).all(id);
  const reviews = db.prepare(`SELECT * FROM reviews WHERE piece_id = ? ORDER BY created_at`).all(id);

  res.json({ piece, turns, drafts, reviews });
});
