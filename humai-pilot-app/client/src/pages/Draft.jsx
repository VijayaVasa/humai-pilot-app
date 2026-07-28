import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Draft() {
  const { type, id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    const data = await api.getPiece(type, id);
    setPiece(data.piece);
    setDrafts(data.drafts);
  }

  useEffect(() => { load(); }, [type, id]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const fn = type === "narrative" ? api.draftNarrative : api.draftSlide;
      await fn(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!piece) return <p>Loading…</p>;

  const latestDraft = drafts[drafts.length - 1];

  return (
    <div>
      <h1>{piece.title}</h1>
      <span className={`status-pill status-${piece.status}`}>{piece.status.replace("_", " ")}</span>

      {!latestDraft && (
        <div className="card">
          <p>Interview complete. Ready to {type === "narrative" ? "draft the article" : "build the storyline"}.</p>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? "Working…" : type === "narrative" ? "Draft article" : "Build storyline"}
          </button>
          {error && <p style={{ color: "#b3261e" }}>{error}</p>}
        </div>
      )}

      {latestDraft && (
        <>
          <div className="card">
            <h3>{type === "narrative" ? `Draft v${latestDraft.version}` : `Storyline v${latestDraft.version}`}</h3>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{latestDraft.content}</div>
          </div>

          {type === "narrative" && (
            <div className="card">
              <h3>Critique agent — {latestDraft.passed_automated_check ? "no issues found" : "issues found"}</h3>
              {JSON.parse(latestDraft.critique_flags || "[]").map((f, i) => (
                <div key={i} className="qa-item">
                  <span>{f.issue} <em style={{ color: "#888" }}>({f.location})</em></span>
                  <span>{f.suggestion}</span>
                </div>
              ))}
              {latestDraft.passed_automated_check ? null : (
                <p style={{ fontSize: 13, color: "#777" }}>
                  Two-agent draft-and-critique loop — not a full three-tool cross-check. Escalate only if this doesn't catch what's needed.
                </p>
              )}
            </div>
          )}

          {type === "slide" && (
            <div className="card">
              <h3>Automated 11-point QA — {latestDraft.passed_automated_check ? "passed" : "not passed"}</h3>
              {JSON.parse(latestDraft.qa_checklist || "[]").map((c, i) => (
                <div key={i} className="qa-item">
                  <span>{c.item}</span>
                  <span className={c.passed ? "qa-pass" : "qa-fail"}>{c.passed ? "Pass" : `Fail — ${c.note}`}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {!latestDraft.passed_automated_check && (
              <button className="btn btn-secondary" onClick={generate} disabled={generating}>
                {generating ? "Regenerating…" : "Regenerate after fixing issues"}
              </button>
            )}
            {!!latestDraft.passed_automated_check && (
              <button className="btn btn-primary" onClick={() => navigate(`/review/${type}/${id}`)}>
                Send to human review
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
