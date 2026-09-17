import { Router } from "express";
import multer from "multer";
import officeParser from "officeparser";

export const uploadRouter = Router();

// Files are held in memory only, never written to disk — this backend has
// no persistent disk anyway (see the Postgres migration notes), and a QBR
// or client deck shouldn't sit on the server filesystem regardless.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — generous for a deck or PDF
});

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".txt", ".md"];

function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

// Extracts plain text from an uploaded document (PDF, Word, PowerPoint,
// Excel) so it can be dropped straight into the same "rough input" field
// pasted text already goes into — the agent doesn't need to know whether
// the source material came from a paste or a real file.
uploadRouter.post("/extract-text", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const ext = extensionOf(file.originalname);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({
      error: `Unsupported file type "${ext}". Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`,
    });
  }

  // Plain text and markdown need no parsing at all.
  if (ext === ".txt" || ext === ".md") {
    return res.json({ text: file.buffer.toString("utf-8"), filename: file.originalname });
  }

  try {
    const ast = await officeParser.parseOffice(file.buffer, {
      fileType: ext.slice(1), // buffers have no filename extension of their own, so state it explicitly
    });
    const { value: text } = await ast.to("text", {
      includeImages: false,
      textConfig: { preserveLayout: false, renderNotes: false },
    });
    if (!text || !text.trim()) {
      return res.status(422).json({
        error: "Couldn't find any readable text in this file — it may be scanned images or empty.",
      });
    }
    res.json({ text, filename: file.originalname });
  } catch (err) {
    console.error("Text extraction failed:", err);
    res.status(422).json({
      error: "Couldn't extract text from this file. Try re-saving it, or paste the content directly instead.",
    });
  }
});
