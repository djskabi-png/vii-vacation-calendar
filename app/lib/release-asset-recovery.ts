const RELEASE_ASSET_FAILURE = /(?:ChunkLoadError|Loading (?:CSS )?chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch RSC payload|Failed to fetch[^\n]*\/assets\/)/i;
const RECOVERY_WINDOW_MS = 60_000;
const PUBLIC_CACHE_PREFIX = "vii-public-";

function errorMessages(error: unknown): string[] {
  if (typeof error === "string") return [error];
  if (!error || typeof error !== "object") return [];
  const value = error as { message?: unknown; cause?: unknown; name?: unknown };
  return [
    typeof value.name === "string" ? value.name : "",
    typeof value.message === "string" ? value.message : "",
    ...errorMessages(value.cause),
  ].filter(Boolean);
}

export function isReleaseAssetMismatch(error: unknown) {
  return RELEASE_ASSET_FAILURE.test(errorMessages(error).join("\n"));
}

async function clearPublicReleaseCaches() {
  if (!("caches" in window)) return;
  try {
    const names = await window.caches.keys();
    await Promise.allSettled(names.filter((name) => name.startsWith(PUBLIC_CACHE_PREFIX)).map((name) => window.caches.delete(name)));
  } catch {
    // CacheStorage can be blocked in private or hardened browser contexts.
    // Recovery must still reach the reload below.
  }
}

function recentlyRecovered(key: string, now: number) {
  try {
    const previous = Number(window.sessionStorage.getItem(key) || 0);
    if (Number.isFinite(previous) && now - previous <= RECOVERY_WINDOW_MS) return true;
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Session storage is optional. The current navigation still gets one
    // recovery attempt; the route boundary remains available if it fails.
  }
  return false;
}

export async function recoverReleaseAssetMismatch(error: unknown, boundary: "route" | "global") {
  if (!isReleaseAssetMismatch(error) || typeof window === "undefined") return false;
  const key = `vii:release-asset-recovery:${boundary}:${window.location.pathname}`;
  if (recentlyRecovered(key, Date.now())) return false;
  await clearPublicReleaseCaches();
  window.location.reload();
  return true;
}
