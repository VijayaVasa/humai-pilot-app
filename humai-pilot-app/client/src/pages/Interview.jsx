import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Interview() {
  const { type, id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [turns, setTurns] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getPiece(type, id);
      setPiece(data.piece);
      setTurns(data.turns);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [type, id]);

  const answeredTurns = turns.filter((t) => t.answer !== null);
  const pendingTurn = turns.find((t) => t.answer === null);

  async function handleSubmit() {
    if (!answer.trim() || !pendingTurn) return;
    setSubmitting(true);
    setError(null);
    try {
      const fn = type === "narrative" ? api.answerNarrative : api.answerSlide;
      const result = await fn(id, pendingTurn.id, answer);
      setAnswer("");
      if (result.readyToDraft) {
        navigate(`/draft/${type}/${id}`);
      } else {
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (type !== "narrative") return;
    setSubmitting(true);
    try {
      await api.skipToDraftNarrative(id);
      navigate(`/draft/${type}/${id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!piece) return <p>Piece not found.</p>;

  return (
    <div>
      <h1>{piece.title}</h1>
      <span className={`status-pill status-${piece.status}`}>{piece.status.replace("_", " ")}</span>

      {piece.synthesis && (
        <div className="card">
          <h3>Synthesis</h3>
          <p>{piece.synthesis}</p>
          <p style={{ fontSize: 13, color: "#777" }}>
            If this misreads the source, answer the questions below to correct course —
            the agent adapts as you go.
          </p>
        </div>
      )}

      {answeredTurns.length > 0 && (
        <div className="card">
          <h3>Interview so far</h3>
          {answeredTurns.map((t) => (
            <div className="qa-turn" key={t.id}>
              <div className="q">{t.question}</div>
              <div className="a">{t.answer}</div>
            </div>
          ))}
        </div>
      )}

      {pendingTurn && (
        <div className="card equal-weight">
          <h3>{pendingTurn.question}</h3>
          <textarea
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
          />
          {error && <p style={{ color: "#b3261e" }}>{error}</p>}
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Thinking…" : "Answer"}
            </button>
            {type === "narrative" && answeredTurns.length >= 4 && (
              <button className="btn btn-secondary" onClick={handleSkip} disabled={submitting}>
                Skip ahead to draft
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
