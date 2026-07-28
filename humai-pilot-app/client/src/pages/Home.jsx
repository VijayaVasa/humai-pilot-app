import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Home() {
  const [type, setType] = useState(null); // 'narrative' | 'slide'
  const [title, setTitle] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleStart() {
    if (!sourceNotes.trim()) {
      setError("Paste in the rough input first — data, a draft, or deck notes.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result =
        type === "narrative"
          ? await api.startNarrative(sourceNotes, title)
          : await api.startSlide(sourceNotes, title);
      navigate(`/interview/${type}/${result.pieceId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!type) {
    return (
      <div>
        <h1>Start a new piece</h1>
        <p>Matches the flowchart's first decision — narrative or slide task?</p>
        <div className="task-picker">
          <div className="card equal-weight" onClick={() => setType("narrative")}>
            <h2>Narrative piece</h2>
            <p>Article, LinkedIn post — the PR agent interviews you first.</p>
          </div>
          <div className="card equal-weight" onClick={() => setType("slide")}>
            <h2>Slide deck</h2>
            <p>Storyline + talking points, built to the HUMAI brand template.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{type === "narrative" ? "New narrative piece" : "New deck"}</h1>
      <div className="card">
        <label>Title (optional)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working title" />
        <div style={{ height: 14 }} />
        <label>Rough input — data, a draft, or deck notes</label>
        <textarea
          rows={10}
          value={sourceNotes}
          onChange={(e) => setSourceNotes(e.target.value)}
          placeholder="Paste whatever you have — the agent reads and synthesizes this before interviewing."
        />
        {error && <p style={{ color: "#b3261e" }}>{error}</p>}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={handleStart} disabled={loading}>
            {loading ? "Reading & synthesizing…" : "Start"}
          </button>
          <button className="btn btn-secondary" onClick={() => setType(null)}>Back</button>
        </div>
      </div>
    </div>
  );
}
