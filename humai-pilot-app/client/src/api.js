const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listPieces: () => req("/pieces"),
  getPiece: (type, id) => req(`/${type}/pieces/${id}`),

  startNarrative: (sourceNotes, title) =>
    req("/narrative/pieces", { method: "POST", body: JSON.stringify({ sourceNotes, title }) }),
  answerNarrative: (id, turnId, answer) =>
    req(`/narrative/pieces/${id}/answer`, { method: "POST", body: JSON.stringify({ turnId, answer }) }),
  skipToDraftNarrative: (id) =>
    req(`/narrative/pieces/${id}/skip-to-draft`, { method: "POST" }),
  draftNarrative: (id) =>
    req(`/narrative/pieces/${id}/draft`, { method: "POST" }),

  startSlide: (sourceNotes, title) =>
    req("/slide/pieces", { method: "POST", body: JSON.stringify({ sourceNotes, title }) }),
  answerSlide: (id, turnId, answer) =>
    req(`/slide/pieces/${id}/answer`, { method: "POST", body: JSON.stringify({ turnId, answer }) }),
  draftSlide: (id) =>
    req(`/slide/pieces/${id}/draft`, { method: "POST" }),

  review: (id, draftId, decision, sentBackTo, notes) =>
    req(`/pieces/${id}/review`, { method: "POST", body: JSON.stringify({ draftId, decision, sentBackTo, notes }) }),
  ship: (id) => req(`/pieces/${id}/ship`, { method: "POST" }),
};
