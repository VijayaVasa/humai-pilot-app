// Hardcoded directly to the deployed Render backend URL. An env-var based
// approach was tried first but didn't reliably propagate through Vercel's
// build, so this is the simple, guaranteed-to-work fallback for a single
// pilot deployment. Update this line directly if the backend URL ever changes.
const BASE = "https://humai-pilot-app.onrender.com/api";

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

  // Multipart upload — deliberately doesn't go through req(), since that
  // helper always sets Content-Type: application/json. FormData needs the
  // browser to set its own multipart boundary automatically.
  extractText: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/extract-text`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  startNarrative: (sourceNotes, title, createdBy) =>
    req("/narrative/pieces", { method: "POST", body: JSON.stringify({ sourceNotes, title, createdBy }) }),
  answerNarrative: (id, turnId, answer) =>
    req(`/narrative/pieces/${id}/answer`, { method: "POST", body: JSON.stringify({ turnId, answer }) }),
  skipToDraftNarrative: (id) =>
    req(`/narrative/pieces/${id}/skip-to-draft`, { method: "POST" }),
  draftNarrative: (id) =>
    req(`/narrative/pieces/${id}/draft`, { method: "POST" }),

  startSlide: (sourceNotes, title, createdBy) =>
    req("/slide/pieces", { method: "POST", body: JSON.stringify({ sourceNotes, title, createdBy }) }),
  answerSlide: (id, turnId, answer) =>
    req(`/slide/pieces/${id}/answer`, { method: "POST", body: JSON.stringify({ turnId, answer }) }),
  draftSlide: (id) =>
    req(`/slide/pieces/${id}/draft`, { method: "POST" }),

  review: (id, draftId, decision, sentBackTo, notes) =>
    req(`/pieces/${id}/review`, { method: "POST", body: JSON.stringify({ draftId, decision, sentBackTo, notes }) }),
  ship: (id) => req(`/pieces/${id}/ship`, { method: "POST" }),
};
