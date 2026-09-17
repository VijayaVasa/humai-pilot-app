import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Home() {
  const [type, setType] = useState(null); // 'narrative' | 'slide'
  const [title, setTitle] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]); // [{name}]
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleFileSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file later if needed
    if (files.length === 0) return;

    setExtracting(true);
    setError(null);
    for (const file of files) {
      try {
        const { text, filename } = await api.extractText(file);
        setSourceNotes((prev) =>
          (prev ? prev + "\n\n" : "") + `--- From: ${filename} ---\n${text}`
        );
        setAttachedFiles((prev) => [...prev, { name: filename }]);
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
    setExtracting(false);
  }

  async function handleStart() {
    if (!createdBy.trim()) {
      setError("Your name is required — so it's clear who created this piece.");
      return;
    }
    if (!sourceNotes.trim()) {
      setError("Paste in the rough input first, or upload a document — data, a draft, deck notes, or a real QBR/brief.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result =
        type === "narrative"
          ? await api.startNarrative(sourceNotes, title, createdBy)
          : await api.startSlide(sourceNotes, title, createdBy);
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
        <label>Your name <span style={{ color: "#b3261e" }}>*</span></label>
        <input type="text" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Required — so we know who created this" />
        <div style={{ height: 14 }} />
        <label>Title (optional)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working title" />
        <div style={{ height: 14 }} />
        <label>Upload real material (optional)</label>
        <p style={{ fontSize: 13, color: "#777", margin: "4px 0 8px" }}>
          A QBR, a client deck, a brief, a data export — PDF, Word, PowerPoint, or Excel.
          Text is extracted automatically and added below; you can still edit or add to it by hand.
        </p>
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.txt,.md"
          multiple
          onChange={handleFileSelected}
          disabled={extracting}
        />
        {extracting && <p style={{ fontSize: 13, color: "#777" }}>Reading document…</p>}
        {attachedFiles.length > 0 && (
          <ul style={{ fontSize: 13, color: "#414141", marginTop: 8 }}>
            {attachedFiles.map((f, i) => (
              <li key={i}>{f.name}</li>
            ))}
          </ul>
        )}
        <div style={{ height: 14 }} />
        <label>Rough input — data, a draft, or deck notes</label>
        <textarea
          rows={10}
          value={sourceNotes}
          onChange={(e) => setSourceNotes(e.target.value)}
          placeholder="Paste whatever you have, or upload a document above — the agent reads and synthesizes this before interviewing."
        />
        {error && <p style={{ color: "#b3261e" }}>{error}</p>}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={handleStart} disabled={loading || extracting}>
            {loading ? "Reading & synthesizing…" : "Start"}
          </button>
          <button className="btn btn-secondary" onClick={() => setType(null)}>Back</button>
        </div>
      </div>
    </div>
  );
}
