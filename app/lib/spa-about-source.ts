function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** Remove only repeated summary material; preserve every unique source fact. */
export function filterSpaSourceAbout(summary: string, about: string[]): string[] {
  const normalizedSummary = normalize(summary);
  if (!normalizedSummary) return about.map(normalize).filter(Boolean);
  return about.map(normalize).filter(Boolean).flatMap((paragraph) => {
    if (paragraph === normalizedSummary) return [];
    if (paragraph.startsWith(`${normalizedSummary} `)) {
      const remainder = paragraph.slice(normalizedSummary.length).trim();
      return remainder ? [remainder] : [];
    }
    return [paragraph];
  });
}
