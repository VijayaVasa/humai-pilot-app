import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NARRATIVE_SKILL = fs.readFileSync(
  path.join(__dirname, "skills", "HUMAI_Narrative_Agent_Skill.md"),
  "utf-8"
);
const SLIDE_SKILL = fs.readFileSync(
  path.join(__dirname, "skills", "HUMAI_pptx_agent_prompt_v2.md"),
  "utf-8"
);

const MODEL = "claude-sonnet-4-6"; // update to whichever model your account should pilot on

/**
 * Core call wrapper. Every agent call in this app goes through here so the
 * right skill file is always the system prompt — never ad-libbed inline.
 */
async function callClaude({ system, messages, maxTokens = 2000 }) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * Narrative Agent — synthesize the source material before interviewing.
 * Mirrors Section 2, Step 1 of the skill file.
 */
export async function synthesizeSource(sourceNotes) {
  const system = `${NARRATIVE_SKILL}

You are at Step 1: read and synthesize the source material below. Identify the
diagnosis, the pivotal decision, the people/roles, the mechanics, and the numbers
(numbers last). Return a short synthesis (4-6 sentences) confirming your
understanding, in plain prose — not a bulleted recap. This will be shown to the
person before the interview starts, so they can correct you early.`;

  return callClaude({
    system,
    messages: [{ role: "user", content: `Source material:\n\n${sourceNotes}` }],
  });
}

/**
 * Narrative Agent — generate the next interview question, one at a time.
 * priorTurns: [{question, answer}] in order.
 */
export async function nextInterviewQuestion({ sourceNotes, synthesis, priorTurns }) {
  const system = `${NARRATIVE_SKILL}

You are at Step 2: the one-question-at-a-time interview. Never ask more than one
question. If prior turns exist, briefly reflect what you heard in one line, then
ask the next question — adapt it to what the previous answer surfaced, per the
default question arc in Section 2. If there's already enough concrete material
(usually after 4-7 answered questions), respond with exactly: READY_TO_DRAFT
instead of another question.`;

  const historyText = priorTurns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer ?? "(unanswered)"}`)
    .join("\n\n");

  return callClaude({
    system,
    messages: [
      {
        role: "user",
        content: `Source synthesis:\n${synthesis}\n\nSource material:\n${sourceNotes}\n\nInterview so far:\n${historyText || "(no turns yet — ask the first question)"}`,
      },
    ],
  });
}

/**
 * Narrative Agent — draft the article/snippets from source + interview answers.
 */
export async function draftNarrative({ sourceNotes, synthesis, priorTurns }) {
  const system = `${NARRATIVE_SKILL}

You are at Step 3: draft the article. Follow the Output Pattern in Section 4 and
the structure in Section 2, Step 3. Use the interview answers as the primary
texture — don't just restate the source's bullet points. Never fabricate a quote;
attribute quotes only to named people the interview actually named. Output the
full article draft, followed by a short LinkedIn snippet version.`;

  const historyText = priorTurns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer ?? "(unanswered)"}`)
    .join("\n\n");

  return callClaude({
    system,
    messages: [
      {
        role: "user",
        content: `Source synthesis:\n${synthesis}\n\nSource material:\n${sourceNotes}\n\nInterview answers:\n${historyText}`,
      },
    ],
    maxTokens: 3000,
  });
}

/**
 * Narrative Agent — critique agent pass. Checks tone, brand rules, banned phrases.
 * Returns structured JSON: { issuesFound: bool, flags: [{issue, location, suggestion}] }
 */
export async function critiqueNarrative(draftText) {
  const system = `${NARRATIVE_SKILL}

You are the critique agent from Section 2's two-agent loop. Check the draft below
against Section 3 (voice), Section 4 (output pattern), and Section 7 (review
checklist). Respond ONLY with JSON, no preamble, no markdown fences, matching
exactly this shape:
{"issuesFound": true|false, "flags": [{"issue": "...", "location": "...", "suggestion": "..."}]}`;

  const raw = await callClaude({
    system,
    messages: [{ role: "user", content: draftText }],
  });

  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { issuesFound: true, flags: [{ issue: "Critique agent returned non-JSON output", location: "n/a", suggestion: "Review manually: " + raw.slice(0, 300) }] };
  }
}

/**
 * Slide Agent — build the storyline + talking points from source + interview.
 */
export async function buildStoryline({ sourceNotes, priorTurns }) {
  const system = `${SLIDE_SKILL}

You are building the storyline and talking points for a deck (not yet touching
actual PowerPoint files — this pilot app scaffold produces the storyline/content
plan; slide construction itself still happens via Claude Cowork on the .pptx).
Reference the framework -> layout mapping table so the storyline names which
layout each section should use. Follow the framing and copy rules exactly
(assertion titles, no "recommended" language, equal-weight cards).`;

  const historyText = priorTurns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer ?? "(unanswered)"}`)
    .join("\n\n");

  return callClaude({
    system,
    messages: [
      { role: "user", content: `Source material:\n${sourceNotes}\n\nInterview answers:\n${historyText}` },
    ],
    maxTokens: 3000,
  });
}

/**
 * Slide Agent — the automated 11-point QA check.
 * Returns structured JSON: { passed: bool, checklist: [{item, passed, note}] }
 */
const QA_ITEMS = [
  "Story flow", "Visual hierarchy", "Visual consistency", "Title quality",
  "Text density", "Image placement", "Branding", "Readability",
  "Speaker flow", "Duplicate slides", "Inconsistent messaging",
];

export async function runSlideQA(storylineOrDeckText) {
  const system = `${SLIDE_SKILL}

Run the automated 11-point QA check against this checklist, in this exact order:
${QA_ITEMS.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}
Respond ONLY with JSON, no preamble, no markdown fences, matching exactly:
{"passed": true|false, "checklist": [{"item": "...", "passed": true|false, "note": "..."}]}`;

  const raw = await callClaude({
    system,
    messages: [{ role: "user", content: storylineOrDeckText }],
  });

  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return {
      passed: false,
      checklist: QA_ITEMS.map((item) => ({ item, passed: false, note: "QA agent returned non-JSON output — review manually" })),
    };
  }
}
