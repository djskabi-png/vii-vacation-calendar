// A pending snapshot is a single server-owned provider operation, not a
// failed request. Keep observing it through the provider's 20s deadline and
// bounded catalog enrichment, without issuing another supplier transaction.
// Discovery refresh is a visible, bounded UI state. The origin responds with
// `refreshing` quickly and owns the single supplier operation in the
// background; the browser only observes that operation. Never leave a person
// on a skeleton for tens of seconds.
export const DISCOVERY_RECOVERY_BUDGET_MS = 8_500;
export const discoveryRecoveryDelays = [600, 1_000, 1_600, 2_400] as const;

export function discoveryRecoveryDelay(attempt: number, remainingMs: number) {
  const delay = discoveryRecoveryDelays[attempt];
  return delay !== undefined && remainingMs > delay ? delay : null;
}
