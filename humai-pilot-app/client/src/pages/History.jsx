import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function routeFor(status, type, id) {
  if (status === "interviewing") return `/interview/${type}/${id}`;
  if (status === "drafting" || status === "needs_revision") return `/draft/${type}/${id}`;
  return `/review/${type}/${id}`;
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
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.type === "narrative" ? "Narrative" : "Slide"}</td>
                <td><span className={`status-pill status-${p.status}`}>{p.status.replace("_", " ")}</span></td>
                <td>{new Date(p.updated_at).toLocaleString()}</td>
                <td><Link to={routeFor(p.status, p.type, p.id)}>Open</Link></td>
              </tr>
            ))}
            {pieces.length === 0 && (
              <tr><td colSpan={5}>No pieces yet — start one from "New piece."</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
