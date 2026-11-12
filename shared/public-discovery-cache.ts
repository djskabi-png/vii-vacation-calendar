import { dealClockKey } from "../app/lib/deal-clock.ts";

const queries = new Map<string, Set<string>>([
  ["/api/vii/home-deals", new Set(["period", "locale", "proof", "clock", "region", "guests"])],
  ["/api/vii/home-holidays", new Set(["locale", "clock", "all"])],
  ["/api/vii/home-holiday-deals", new Set(["id", "guests", "part", "from", "till", "proof", "clock"])],
  ["/api/spa/deals", new Set(["clock", "region", "full", "date", "rotation"])],
]);
const periods = new Set(["tomorrow", "weekend", "friday-weekend", "thursday", "friday"]);
const privateHeaders = ["Authorization", "Next-Action", "X-Server-Action", "RSC", "Next-Router-State-Tree", "Next-Router-Prefetch", "Next-Router-Segment-Prefetch", "Next-Url", "X-Vinext-Interception-Context", "X-Vinext-Mounted-Slots", "X-Vinext-Rsc-Render-Mode"];

/** Only four anonymous discovery APIs, never a quote, search, action or lead.
 * Exact URL/query/build identity is retained by both callers. No stale grace. */
export function publicDiscoveryCachePolicy(request: Request, now = new Date()) {
  if (request.method !== "GET" || privateHeaders.some(name => request.headers.has(name))) return null;
  const url = new URL(request.url), allowed = queries.get(url.pathname);
  if (!allowed || url.search.length > 600) return null;
  const params = url.searchParams, seen = new Set<string>();
  for (const [key, value] of params) {
    if (!allowed.has(key) || seen.has(key) || value.length > 80) return null;
    seen.add(key);
  }
  if (params.get("clock") !== dealClockKey(now)) return null;
  if (params.has("locale") && !["he", "en", "fr", "ru"].includes(params.get("locale")!)) return null;
  if (params.has("proof") && params.get("proof") !== "verified-offers-v1") return null;
  if (params.has("rotation") && !/^[a-z0-9:_-]{1,128}$/i.test(params.get("rotation")!)) return null;
  if (params.has("guests") && (!/^[1-9]\d?$/.test(params.get("guests")!) || Number(params.get("guests")) > 50)) return null;
  if (url.pathname === "/api/vii/home-deals" && !periods.has(params.get("period") || "")) return null;
  if (url.pathname === "/api/vii/home-holiday-deals" && !/^[1-9]\d{0,8}$/.test(params.get("id") || "")) return null;
  if (params.has("part") && !["all", "opening", "middle", "ending"].includes(params.get("part")!)) return null;
  for (const key of ["from", "till", "date"]) if (params.has(key) && !/^\d{4}-\d{2}-\d{2}$/.test(params.get(key)!)) return null;
  for (const key of ["all", "full"]) if (params.has(key) && params.get(key) !== "1") return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const number = (name: string) => Number(parts.find(part => part.type === name)?.value || 0);
  const seconds = number("hour") * 3600 + number("minute") * 60 + number("second");
  const boundary = seconds < 14 * 3600 ? 14 * 3600 : 24 * 3600;
  const ttlSeconds = Math.min(30, Math.floor(((boundary - seconds) * 1000 - now.getMilliseconds()) / 1000));
  return ttlSeconds > 0 ? { ttlSeconds, expiresAt: now.getTime() + ttlSeconds * 1000 } : null;
}
