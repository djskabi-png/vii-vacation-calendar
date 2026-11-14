type Selection = { from: string; till: string };
type AvailabilityState = {
  status: "idle" | "loading" | "ready" | "error";
  quote: null | {
    from: string;
    till: string;
    availability: "available" | "unavailable" | "unknown";
  };
};

/**
 * Dated discovery is a truth boundary, not a ranking hint. A result belongs in
 * a dated result set only after the same request key produced an explicit
 * available answer. Unknown, loading, failed and mismatched answers remain out.
 */
export function hasConfirmedDatedAvailability(state: AvailabilityState | undefined, selection: Selection | null | undefined) {
  const quote = state?.quote;
  return Boolean(selection
    && state?.status === "ready"
    && quote?.availability === "available"
    && quote.from === selection.from
    && quote.till === selection.till);
}

/**
 * Dated discovery keeps the complete place inventory visible after the live
 * check. Exact answers are ranked by their commercial state; missing or failed
 * answers remain an unknown state instead of disappearing. A quote from a
 * different stay is never accepted as evidence for the selected dates.
 */
export function canShowDatedSearchResult(state: AvailabilityState | undefined, selection: Selection | null | undefined) {
  const quote = state?.quote;
  if (!selection) return false;
  // Loading and transport failure are not evidence that a place is
  // unavailable. Keep the catalogue card visible with its honest checking or
  // fallback state; only a mismatched quote is rejected.
  if (!quote) return true;
  return quote.from === selection.from && quote.till === selection.till;
}

export function datedSearchResultTier(input: {
  availability: "available" | "unavailable" | "unknown";
  hasPrice: boolean;
  onlineBookable?: boolean;
}) {
  if (input.availability === "available" && input.hasPrice && input.onlineBookable) return 0;
  if (input.availability === "available" && input.hasPrice) return 1;
  if (input.availability === "unknown") return input.hasPrice ? 2 : 3;
  return 4;
}

export function hasConfirmedEventAvailability(result: { available: boolean | null; total: number | null; from: string | null } | undefined) {
  return result?.available === true && typeof result.total === "number" && result.total > 0 && Boolean(result.from);
}
