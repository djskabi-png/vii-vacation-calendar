import { dealClockKey } from "../app/lib/deal-clock.ts";

/** Relative public pages contain date-driven rails. HTML and Flight must use
 * the same Israel-day/cutoff partition, including the outer delivery cache. */
export function publicDocumentClock(pathname: string, now = new Date()) {
  const path = (pathname.endsWith(".rsc") ? pathname.slice(0, -4) || "/" : pathname)
    .replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
  return path === "/" || /^\/(?:business|last-minute|weekend|holidays|events|spas)(?:\/|$)/.test(path)
    ? dealClockKey(now) : null;
}

/** This only shortens an existing lifetime. The short public TTLs mean a
 * cutoff can be reached only near midnight or 14:00, outside DST changes. */
export function publicDocumentExpiry(pathname: string, expiresAt: number, now = new Date()) {
  if (!publicDocumentClock(pathname, now)) return expiresAt;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const value = (name: string) => Number(parts.find(part => part.type === name)?.value || 0);
  const seconds = value("hour") * 3600 + value("minute") * 60 + value("second");
  const boundary = seconds < 14 * 3600 ? 14 * 3600 : 24 * 3600;
  const remaining = (boundary - seconds) * 1000 - now.getMilliseconds();
  return Math.min(expiresAt, now.getTime() + remaining);
}
