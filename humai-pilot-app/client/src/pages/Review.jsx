import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Review() {
  const { type, id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    const data = await api.getPiece(type, id);
    setPiece(data.piece);
    setDrafts(data.drafts);
  }

  useEffect(() => { load(); }, [type, id]);

  if (!piece) return <p>Loading…</p>;
  const latestDraft = drafts[drafts.length - 1];

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api.review(id, latestDraft.id, "approved", null, notes);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendBack() {
    setBusy(true);
    setError(null);
    try {
      await api.review(id, latestDraft.id, "sent_back", "drafting", notes);
      navigate(`/draft/${type}/${id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function ship() {
    setBusy(true);
    setError(null);
    try {
      await api.ship(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{piece.title}</h1>
      <span className={`status-pill status-${piece.status}`}>{piece.status.replace("_", " ")}</span>

      <div className="card">
        <h3>Content for review</h3>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{latestDraft?.content}</div>
      </div>

      <div className="card">
        <h3>Authenticity edit / final judgment</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Review notes (optional) — reasons for approval or what needs revision"
        />
        {error && <p style={{ color: "#b3261e" }}>{error}</p>}

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          {piece.status !== "approved" && piece.status !== "shipped" && (
            <>
              <button className="btn btn-primary" onClick={approve} disabled={busy}>Approve</button>
              <button className="btn btn-secondary" onClick={sendBack} disabled={busy}>
                No — back to relevant agent step
              </button>
            </>
          )}
          {piece.status === "approved" && (
            <button className="btn btn-coral" onClick={ship} disabled={busy}>
              Ship — publish or present
            </button>
          )}
          {piece.status === "shipped" && <p>Shipped. A human has published or presented this.</p>}
        </div>
      </div>
    </div>
  );
}
