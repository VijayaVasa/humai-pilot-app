import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// DATABASE_URL is provided automatically by Render when you attach a
// Postgres instance to this service. Locally, set it in .env if you
// want to test against a real Postgres (see README for options).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; disable only for a fully
  // local Postgres instance without SSL configured.
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pieces (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('narrative', 'slide')),
      title TEXT NOT NULL DEFAULT '(untitled)',
      created_by TEXT NOT NULL DEFAULT '(unknown)',
      status TEXT NOT NULL DEFAULT 'interviewing'
        CHECK (status IN (
          'interviewing', 'drafting', 'needs_revision',
          'in_review', 'approved', 'shipped'
        )),
      source_notes TEXT,
      synthesis TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Safe to run even if the table already existed before this column was
  // added — ADD COLUMN IF NOT EXISTS is a no-op on a database that already
  // has it, so this doesn't need a separate migration step.
  await pool.query(`
    ALTER TABLE pieces ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '(unknown)';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_turns (
      id TEXT PRIMARY KEY,
      piece_id TEXT NOT NULL REFERENCES pieces(id),
      turn_index INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      piece_id TEXT NOT NULL REFERENCES pieces(id),
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      critique_flags TEXT,
      qa_checklist TEXT,
      passed_automated_check INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      piece_id TEXT NOT NULL REFERENCES pieces(id),
      draft_id TEXT NOT NULL REFERENCES drafts(id),
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'sent_back')),
      sent_back_to TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function touch(pieceId) {
  await pool.query(`UPDATE pieces SET updated_at = now() WHERE id = $1`, [pieceId]);
}
