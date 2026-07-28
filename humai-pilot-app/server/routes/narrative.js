import { Router } from "express";
import { nanoid } from "nanoid";
import { db, touch } from "../db.js";
import {
  synthesizeSource,
  nextInterviewQuestion,
  draftNarrative,
  critiqueNarrative,
} from "../claude.js";

export const narrativeRouter = Router();

// Start a new narrative piece: submit rough input, get the synthesis + first question.
narrativeRouter.post("/pieces", async (req, res) => {
  const { sourceNotes, title } = req.body;
  if (!sourceNotes || !sourceNotes.trim()) {
    return res.status(400).json({ error: "sourceNotes is required" });
  }

  const id = nanoid();
  const synthesis = await synthesizeSource(sourceNotes);

  db.prepare(
    `INSERT INTO pieces (id, type, title, status, source_notes, synthesis)
     VALUES (?, 'narrative', ?, 'interviewing', ?, ?)`
  ).run(id, title || "(untitled narrative piece)", sourceNotes, synthesis);

  const firstQuestion = await nextInterviewQuestion({
    sourceNotes,
    synthesis,
    priorTurns: [],
  });

  const turnId = nanoid();
  db.prepare(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES (?, ?, 0, ?)`
  ).run(turnId, id, firstQuestion);

  res.json({ pieceId: id, synthesis, firstQuestion, turnId });
});

// Answer the current question, get the next one (or READY_TO_DRAFT).
narrativeRouter.post("/pieces/:id/answer", async (req, res) => {
  const { id } = req.params;
  const { turnId, answer } = req.body;

  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ?`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });

  db.prepare(`UPDATE interview_turns SET answer = ? WHERE id = ?`).run(answer, turnId);
  touch(id);

  const priorTurns = db
    .prepare(`SELECT question, answer FROM interview_turns WHERE piece_id = ? ORDER BY turn_index`)
    .all(id);

  const nextQ = await nextInterviewQuestion({
    sourceNotes: piece.source_notes,
    synthesis: piece.synthesis,
    priorTurns,
  });

  if (nextQ.includes("READY_TO_DRAFT")) {
    db.prepare(`UPDATE pieces SET status = 'drafting' WHERE id = ?`).run(id);
    return res.json({ readyToDraft: true });
  }

  const nextIndex = priorTurns.length;
  const newTurnId = nanoid();
  db.prepare(
    `INSERT INTO interview_turns (id, piece_id, turn_index, question) VALUES (?, ?, ?, ?)`
  ).run(newTurnId, id, nextIndex, nextQ);

  res.json({ readyToDraft: false, nextQuestion: nextQ, turnId: newTurnId });
});

// Person can also skip ahead early, per the skill file's "respect the skip" rule.
narrativeRouter.post("/pieces/:id/skip-to-draft", (req, res) => {
  const { id } = req.params;
  db.prepare(`UPDATE pieces SET status = 'drafting' WHERE id = ?`).run(id);
  res.json({ ok: true });
});

// Draft the article, then immediately run the critique agent (the two-agent loop).
narrativeRouter.post("/pieces/:id/draft", async (req, res) => {
  const { id } = req.params;
  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ?`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const priorTurns = db
    .prepare(`SELECT question, answer FROM interview_turns WHERE piece_id = ? ORDER BY turn_index`)
    .all(id);

  const content = await draftNarrative({
    sourceNotes: piece.source_notes,
    synthesis: piece.synthesis,
    priorTurns,
  });
  const critique = await critiqueNarrative(content);

  const version = 1 + (db.prepare(`SELECT COUNT(*) c FROM drafts WHERE piece_id = ?`).get(id).c);
  const draftId = nanoid();
  db.prepare(
    `INSERT INTO drafts (id, piece_id, version, content, critique_flags, passed_automated_check)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(draftId, id, version, content, JSON.stringify(critique.flags || []), critique.issuesFound ? 0 : 1);

  db.prepare(`UPDATE pieces SET status = ? WHERE id = ?`).run(
    critique.issuesFound ? "needs_revision" : "in_review",
    id
  );
  touch(id);

  res.json({ draftId, content, critique });
});

narrativeRouter.get("/pieces/:id", (req, res) => {
  const { id } = req.params;
  const piece = db.prepare(`SELECT * FROM pieces WHERE id = ? AND type = 'narrative'`).get(id);
  if (!piece) return res.status(404).json({ error: "piece not found" });

  const turns = db.prepare(`SELECT * FROM interview_turns WHERE piece_id = ? ORDER BY turn_index`).all(id);
  const drafts = db.prepare(`SELECT * FROM drafts WHERE piece_id = ? ORDER BY version`).all(id);
  const reviews = db.prepare(`SELECT * FROM reviews WHERE piece_id = ? ORDER BY created_at`).all(id);

  res.json({ piece, turns, drafts, reviews });
});
