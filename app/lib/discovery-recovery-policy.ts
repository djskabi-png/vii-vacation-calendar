// A pending snapshot is a single server-owned provider operation, not a
// failed request. Keep observing it through the provider's 20s deadline and
// bounded catalog enrichment, without issuing another supplier transaction.
export const DISCOVERY_RECOVERY_BUDGET_MS = 32_000;
export const discoveryRecoveryDelays = [1_250, 2_500, 4_000, 6_000, 6_000] as const;

export function discoveryRecoveryDelay(attempt: number, remainingMs: number) {
  const delay = discoveryRecoveryDelays[attempt];
  return delay !== undefined && remainingMs > delay ? delay : null;
}
