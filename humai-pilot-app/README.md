# HUMAI Narrative & Slide Agent — Pilot App

Pilot-sized web app implementing the workflow in `HUMAI Agent Workflow Flowchart v2`:
rough input → agent interview (one question at a time, adaptive) → draft →
critique/QA → human review → ship. Both agents (Narrative and Slide) are wired
in, using the two corrected skill files as their actual system prompts.

**Scope note:** this covers the pilot-sized feature set agreed in planning — task
picker, interview, draft/build with critique or QA visible, human review, and a
simple history list. It deliberately does not include team permissions, a shared
knowledge-base UI, or usage analytics — those come after the pilot proves out.

**Important:** the Slide Agent here builds the *storyline and talking points*,
and runs the automated 11-point QA check on that storyline — it does not touch
actual `.pptx` files. Real slide construction still happens via Claude Cowork
against the `.pptx`, per `HUMAI_pptx_agent_prompt_v2.md`'s execution rules
(Office JS batch operations, master/theme checks, etc.), which are written for
that environment specifically, not for a web backend.

## Architecture

```
client/   React + Vite frontend (task picker, interview, draft, review, history)
server/   Node + Express backend
  claude.js         All Claude API calls — loads the two skill files as system prompts
  db.js             SQLite schema — pieces, interview_turns, drafts, reviews
  routes/           narrative.js, slide.js, pieces.js (review/ship/history)
  skills/           Copies of the two corrected skill .md files — keep these in sync
                    with the canonical versions if either changes upstream
```

## Local setup

**Backend:**
```bash
cd server
cp .env.example .env      # then fill in ANTHROPIC_API_KEY
npm install
npm run dev                # http://localhost:8787
```

**Frontend (separate terminal):**
```bash
cd client
npm install
npm run dev                # http://localhost:5173, proxies /api to the backend
```

Open `http://localhost:5173`.

## A note on the API key

`ANTHROPIC_API_KEY` here is a Claude **API** key from console.anthropic.com — not
your Claude.ai Pro/Team login. It's billed separately (API usage, not seats) from
the $20/month or ~$300/month figures already discussed with Finbar. Don't reuse
a Claude.ai session/password here; API keys are the only supported way for this
app to call Claude.

## Deployment (so it's centrally reachable, not just localhost)

This is intentionally simple to deploy since there's no heavy backend state:

1. **Backend:** deploy `server/` to Render or Railway (both have free/low tiers
   that support a persistent SQLite file on disk — check current free-tier disk
   persistence before relying on it long-term; if the tier doesn't persist disk,
   swap `better-sqlite3` for a hosted Postgres, which is a small change isolated
   to `db.js`).
2. **Frontend:** deploy `client/` to Vercel or Netlify. Set the API base URL
   (currently proxied via Vite in dev) to the deployed backend's URL for
   production — see `client/src/api.js`, `const BASE`.
3. Set `ANTHROPIC_API_KEY` as an environment variable on the backend host — never
   commit it, never ship it to the frontend.

## What's next after this pilot

- Wire in the shared knowledge base (once Finbar confirms business-tier data terms)
- Real `.pptx` file generation/preview for the Slide Agent (currently storyline-only)
- Team-level permissions once this moves beyond a single-pilot user
