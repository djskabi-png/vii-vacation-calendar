function reviewScore(entry: unknown) {
  if (!entry || typeof entry !== "object") return undefined;
  const record = entry as Record<string, unknown>;
  const value = typeof record.score === "number" ? record.score : record.rating;
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 10 ? value : undefined;
}

export function normalizeReviewSummary(value: { count?: unknown; score?: unknown; list?: unknown[] }) {
  const list = Array.isArray(value.list) ? value.list : [];
  const count = typeof value.count === "number" && Number.isInteger(value.count) && value.count >= 0 ? value.count : list.length;
  const sourceScore = typeof value.score === "number" && Number.isFinite(value.score) && value.score >= 0 && value.score <= 10 && (count > 0 || list.length > 0) ? value.score : undefined;
  const visibleScores = list.flatMap((entry) => {
    const score = reviewScore(entry);
    return score === undefined ? [] : [score];
  });
  const listIsMoreComplete = list.length > count;
  const score = listIsMoreComplete && visibleScores.length === list.length
    ? Math.round(visibleScores.reduce((sum, current) => sum + current, 0) / visibleScores.length * 10) / 10
    : sourceScore;
  return { count: Math.max(count, list.length), score };
}
