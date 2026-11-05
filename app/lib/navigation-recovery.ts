export const NAVIGATION_START_EVENT = "vii:navigation-start";
export const NAVIGATION_RECOVERY_DELAY_MS = 8_000;
const RECOVERY_KEY = "vii-navigation-recovery-at";
const RECOVERY_COOLDOWN_MS = 60_000;

/** One document GET recovery per minute, never a replay of an action or API. */
export function recoverStalledNavigation(href: string, environment: {
  currentHref: string;
  now: number;
  storage: Pick<Storage, "getItem" | "setItem">;
  replace: (href: string) => void;
}) {
  const target = new URL(href, environment.currentHref);
  const current = new URL(environment.currentHref);
  if (target.origin !== current.origin || target.username || target.password || target.pathname.startsWith("/api/")) return false;
  try {
    const previous = Number(environment.storage.getItem(RECOVERY_KEY));
    if (previous > 0 && Math.abs(environment.now - previous) < RECOVERY_COOLDOWN_MS) return false;
    const reservation = String(environment.now);
    environment.storage.setItem(RECOVERY_KEY, reservation);
    if (environment.storage.getItem(RECOVERY_KEY) !== reservation) return false;
  } catch { return false; }
  // Original query/hash and browser credentials survive a normal document GET.
  // No target URL, contact or search terms are persisted in the loop guard.
  environment.replace(target.href);
  return true;
}
