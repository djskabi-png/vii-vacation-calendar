export type WorldLandingFaq = { question: string; answer: string };

/** The same bounded payload is stored by the versioned world-landing editor. */
export function decodeWorldLandingFaq(raw: unknown): WorldLandingFaq[] | null {
  if (raw === undefined || raw === "") return [];
  if (typeof raw !== "string" || raw.length > 8000) return null;
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 8) return null;
    if (rows.some(row => !row || typeof row !== "object"
      || typeof row.question !== "string" || row.question.length > 180
      || typeof row.answer !== "string" || row.answer.length > 600
      || /[<>]/.test(row.question + row.answer))) return null;
    return rows as WorldLandingFaq[];
  } catch { return null; }
}

export function publicWorldLandingFaq(raw: unknown): WorldLandingFaq[] {
  return (decodeWorldLandingFaq(raw) || [])
    .filter(row => row.question.trim() && row.answer.trim())
    .map(row => ({ question: row.question.trim(), answer: row.answer.trim() }));
}
