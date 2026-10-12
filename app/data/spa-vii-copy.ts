import records from "./spa-vii/copy.json" with { type: "json" };

export type SpaViiCopy = { id: number; sourceHash: string; cardSummary: string; paragraphs: string[]; filterText: string };
const approved = new Map<number, SpaViiCopy>((records as SpaViiCopy[]).map((record) => [record.id, record]));

/** The public text is authored and reviewed per place; supplier prose is never a fallback. */
export function spaViiCopy(id: number): SpaViiCopy {
  const record = approved.get(id);
  if (!record || !record.cardSummary || !record.paragraphs.length) throw new Error("catalog_editorial_requires_review");
  return record;
}
