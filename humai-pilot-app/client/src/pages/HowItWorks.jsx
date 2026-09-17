export default function HowItWorks() {
  return (
    <div>
      <h1>How it works</h1>
      <p>
        Every piece goes through the same flow: an agent interviews you about your
        rough input, drafts something, an automated check reviews it, then a human
        signs off before anything is published or presented. Nothing ships without
        a person approving it.
      </p>

      <div className="card">
        <h3>1. Start with rough input</h3>
        <p>Paste in whatever you already have — notes, a data point, a rough draft, or deck bullet points. It doesn't need to be polished.</p>
      </div>

      <div className="card">
        <h3>2. The agent interviews you</h3>
        <p>It reads what you gave it, shares a quick synthesis to confirm it understood correctly, then asks one question at a time — adapting each question based on your last answer. It's a real interview, not a form.</p>
      </div>

      <div className="card">
        <h3>3. It drafts, then checks itself</h3>
        <p>The Narrative Agent's draft goes through a critique pass (tone, brand rules, banned phrases). The Slide Agent's storyline goes through an 11-point QA checklist. Either can be sent back for a redo automatically if it doesn't pass.</p>
      </div>

      <div className="card">
        <h3>4. You review and ship</h3>
        <p>You read the result, make an authenticity edit if needed, and either approve it or send it back to a specific step. Only an approved piece can be marked shipped — published or presented by a human.</p>
      </div>

      <h2 style={{ marginTop: 32 }}>A quick example — Narrative piece</h2>
      <div className="card equal-weight">
        <p><strong>You paste in:</strong> "Open rates on our newsletter were flat for months. We tried segmenting a re-engagement send instead of just sending more — it beat the control group by 43.85%."</p>
        <p><strong>Agent asks:</strong> "What made the flat open rates finally undeniable — a specific moment, number, or conversation?"</p>
        <p><strong>You answer</strong>, it asks a follow-up building on that, and so on for a few more questions.</p>
        <p><strong>Result:</strong> An article draft plus a LinkedIn snippet, in HUMAI's commercial voice, checked for tone and banned phrases, ready for your review.</p>
      </div>

      <h2 style={{ marginTop: 32 }}>A quick example — Slide deck</h2>
      <div className="card equal-weight">
        <p><strong>You paste in:</strong> Rough notes or bullet points for a client update.</p>
        <p><strong>Agent asks three questions:</strong> the one takeaway the deck needs to land, who the audience is, and whether there's a key slide the deck has to build toward.</p>
        <p><strong>Result:</strong> A storyline and talking points mapped to HUMAI's actual slide layouts and brand rules (assertion-style titles, no "recommended" language, equal-weight cards), checked against an 11-point QA checklist, ready for your review.</p>
      </div>
    </div>
  );
}
