import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const dbPath = process.env.DB_PATH || "./data/humai_pilot.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// One row per piece of work (article or deck), tracking it through every
// stage of the flowchart: interview -> draft -> critique/QA -> human review -> shipped
db.exec(`
CREATE TABLE IF NOT EXISTS pieces (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('narrative', 'slide')),
  title TEXT NOT NULL DEFAULT '(untitled)',
  status TEXT NOT NULL DEFAULT 'interviewing'
    CHECK (status IN (
      'interviewing', 'drafting', 'needs_revision',
      'in_review', 'approved', 'shipped'
    )),
  source_notes TEXT,           -- the raw/rough input the person pasted in to start
  synthesis TEXT,              -- agent's synthesis of the source, shared back before interviewing
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per interview Q&A turn, in order. This is the one-question-at-a-time
-- log — never a batch form. See HUMAI_Narrative_Agent_Skill.md Section 2.
CREATE TABLE IF NOT EXISTS interview_turns (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL REFERENCES pieces(id),
  turn_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,                 -- null until the person responds
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per draft version (article text, or slide storyline), plus the
-- critique/QA pass result attached to it.
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL REFERENCES pieces(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,           -- article body, or slide storyline/talking points
  critique_flags TEXT,             -- JSON array: tone/brand/banned-phrase issues (narrative)
  qa_checklist TEXT,               -- JSON: 11-point pass/fail (slide)
  passed_automated_check INTEGER,  -- 0/1 — did critique/QA come back clean?
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Human review decisions — the only place something can be marked shipped.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL REFERENCES pieces(id),
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'sent_back')),
  sent_back_to TEXT,        -- which step it's returned to, e.g. 'drafting'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function touch(pieceId) {
  db.prepare(`UPDATE pieces SET updated_at = datetime('now') WHERE id = ?`).run(pieceId);
}
