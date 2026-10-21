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

export function hasConfirmedEventAvailability(result: { available: boolean | null; total: number | null; from: string | null } | undefined) {
  return result?.available === true && typeof result.total === "number" && result.total > 0 && Boolean(result.from);
}
