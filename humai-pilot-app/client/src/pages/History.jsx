import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function routeFor(status, type, id) {
  if (status === "interviewing") return `/interview/${type}/${id}`;
  if (status === "drafting" || status === "needs_revision") return `/draft/${type}/${id}`;
  return `/review/${type}/${id}`;
}

// Friendlier, progress-style labels instead of raw status enums —
// meant to read like "where is this in the pipeline" at a glance.
function friendlyStatus(status) {
  switch (status) {
    case "interviewing": return "Interview in progress";
    case "drafting": return "Draft in progress";
    case "needs_revision": return "Draft needs revision";
    case "in_review": return "Draft tested — ready for review";
    case "approved": return "Approved — ready to ship";
    case "shipped": return "Shipped";
    default: return status.replace("_", " ");
  }
}

export default function History() {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    api.listPieces().then(setPieces);
  }, []);

  return (
    <div>
      <h1>History</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Created by</th>
              <th>Progress</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.type === "narrative" ? "Narrative" : "Slide"}</td>
                <td>{p.created_by || "(unknown)"}</td>
                <td><span className={`status-pill status-${p.status}`}>{friendlyStatus(p.status)}</span></td>
                <td>{new Date(p.updated_at).toLocaleString()}</td>
                <td><Link to={routeFor(p.status, p.type, p.id)}>Open</Link></td>
              </tr>
            ))}
            {pieces.length === 0 && (
              <tr><td colSpan={6}>No pieces yet — start one from "Get started."</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

