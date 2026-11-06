import type { D1Database } from "../../types/cloudflare-runtime";
import { initializeSchemaOnce } from "./schema-initializer.ts";
import { adaptQualityChecks, qualityScopeMetadata, selectQualityScope, type QualityScopeSelection } from "./quality-check-scope.ts";
import type { QualityJob } from "./quality-job-store.ts";
import { DISCOVERY_READINESS_VERSION, discoveryReadinessDefinitions, discoveryReadinessProbe } from "./quality-readiness.ts";

export type QualitySeverity = "critical" | "high" | "medium" | "low";
export type QualityStatus = "passed" | "failed" | "degraded" | "blocked";
export type QualityContentKind = "html" | "xml" | "json" | "image";
export type QualityRunLevel = "full" | "medium" | "regular";
export type QualityCheck = {
  checkId: string;
  family: string;
  world: string;
  route: string;
  viewport: "server" | "desktop" | "mobile";
  severity: QualitySeverity;
  cadenceMinutes: number;
  timeoutMs: number;
  expected: string;
  releaseBlocking: boolean;
  contentKind?: QualityContentKind;
  minBytes?: number;
  requiredAll?: readonly string[];
  requiredAny?: readonly string[];
  forbidden?: readonly string[];
  semanticContract?: typeof DISCOVERY_READINESS_VERSION;
};

export type QualityNotificationEnvironment = {
  VII_QUALITY_EMAIL_PROVIDER?: string;
  VII_QUALITY_EMAIL_API_KEY?: string;
  VII_QUALITY_EMAIL_FROM?: string;
  VII_QUALITY_EMAIL_RECIPIENTS?: string;
};

type QualityIncidentEvent = {
  incidentId: string;
  cycle: number;
  eventKind: "opened" | "recovered";
  check: QualityCheck;
  observed: string;
  origin: string;
};

const RUN_STALE_AFTER_MS = 15 * 60_000;
// Keep production QA from becoming its own traffic spike. The manual run reads
// several multi-megabyte sitemap files, so a smaller batch is deliberately
// preferred over faster but noisy false incidents.
const CHECK_CONCURRENCY = 3;

// Production synthetics are intentionally read-only. Browser interaction and
// visual checks remain release-gate jobs; the recurring worker never creates a
// booking, lead, review, payment or message.
const html = (input: Omit<QualityCheck, "contentKind" | "minBytes"> & Partial<Pick<QualityCheck, "minBytes">>): QualityCheck => ({ contentKind: "html", minBytes: 2_000, ...input });
const json = (input: Omit<QualityCheck, "contentKind" | "minBytes" | "viewport"> & Partial<Pick<QualityCheck, "minBytes">>): QualityCheck => ({ contentKind: "json", minBytes: 20, viewport: "server", ...input });

// This is the production-safe layer of the VII QA pyramid. It validates the
// public contract without creating bookings, leads, calls, WhatsApp messages,
// payments or reviews. Browser interaction and visual matrices run separately.
export const qualityRegistry: readonly QualityCheck[] = [
  html({ checkId: "global.home.semantic", family: "global-shell", world: "all", route: "/", viewport: "desktop", severity: "critical", cadenceMinutes: 5, timeoutMs: 10_000, expected: "Home contains the public shell, search and discovery results", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d7\u05d9\u05e4\u05d5\u05e9", "\u05e0\u05d5\u05e4\u05e9"] }),
  html({ checkId: "global.home.en.semantic", family: "multilingual-shell", world: "all", route: "/en", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "English home has its unique URL and server-rendered English document", releaseBlocking: true, requiredAll: ["<html lang=\"en\"", "<main", "hreflang=\"en\""] }),
  html({ checkId: "global.home.fr.semantic", family: "multilingual-shell", world: "all", route: "/fr", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "French home has its unique URL and server-rendered French document", releaseBlocking: true, requiredAll: ["<html lang=\"fr\"", "<main", "hreflang=\"fr\""] }),
  html({ checkId: "global.home.ru.semantic", family: "multilingual-shell", world: "all", route: "/ru", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Russian home has its unique URL and server-rendered Russian document", releaseBlocking: true, requiredAll: ["<html lang=\"ru\"", "<main", "hreflang=\"ru\""] }),
  ...(["en", "fr", "ru"] as const).flatMap((locale): QualityCheck[] => [
    html({ checkId: `locale.${locale}.gift-card.semantic`, family: "multilingual-pages", world: "all", route: `/${locale}/gift-card`, viewport: "desktop", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: `${locale} gift-card page has a unique locale URL and translated document shell`, releaseBlocking: true, requiredAll: [`<html lang=\"${locale}\"`, "<main", `hreflang=\"${locale}\"`] }),
    html({ checkId: `locale.${locale}.guides.semantic`, family: "multilingual-pages", world: "all", route: `/${locale}/guides`, viewport: "desktop", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: `${locale} guides page has a unique locale URL and translated document shell`, releaseBlocking: true, requiredAll: [`<html lang=\"${locale}\"`, "<main", `hreflang=\"${locale}\"`] }),
    html({ checkId: `locale.${locale}.place.semantic`, family: "multilingual-pages", world: "vacations", route: `/${locale}/business?id=vacation-116`, viewport: "mobile", severity: "high", cadenceMinutes: 360, timeoutMs: 14_000, expected: `${locale} place page has a unique locale URL and keeps the core place contract`, releaseBlocking: true, requiredAll: [`<html lang=\"${locale}\"`, "<main", `hreflang=\"${locale}\"`, "property-gallery", "tel:"] }),
  ]),
  html({ checkId: "search.location.semantic", family: "search", world: "vacations", route: "/search?location=%D7%9E%D7%A9%D7%9E%D7%A8%20%D7%94%D7%99%D7%A8%D7%93%D7%9F", viewport: "desktop", severity: "critical", cadenceMinutes: 5, timeoutMs: 12_000, expected: "Sparse-location search keeps the server-rendered search shell and no error surface; hydrated results are covered by browser QA and catalog probes", releaseBlocking: true, requiredAll: ["<main", "results-list"], forbidden: ["Error 1102", "Worker exceeded resource limits", "404 Not Found"] }),
  html({ checkId: "place.vacation.semantic", family: "place-pages", world: "vacations", route: "/business?id=vacation-116", viewport: "mobile", severity: "critical", cadenceMinutes: 5, timeoutMs: 14_000, expected: "Vacation place contains gallery, contacts, reviews and location", releaseBlocking: true, requiredAll: ["property-gallery", "tel:", "\u05d7\u05d5\u05d5\u05ea \u05d3\u05e2\u05ea", "\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4", "WhatsApp"] }),
  html({ checkId: "place.vacation.legacy-parity", family: "place-pages", world: "vacations", route: "/business?id=vacation-2210", viewport: "mobile", severity: "critical", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Legacy vacation parity keeps all verified bedrooms and supplier amenity topics", releaseBlocking: true, requiredAll: ["חדר שינה 1 - סוויטת הורים", "מתחם חיצוני", "מתחם פנימי", "מטבח מאובזר", "חדרי הרחצה", "לציבור הדתי", "במיוחד לילדים", "ניתן להזמין"] }),
  html({ checkId: "place.vacation.sleeping-fallback", family: "place-pages", world: "vacations", route: "/business?id=vacation-2574", viewport: "mobile", severity: "critical", cadenceMinutes: 60, timeoutMs: 14_000, expected: "A verified room-level bedroom count keeps the main sleeping section even when the supplier group has a custom title", releaseBlocking: true, requiredAll: ["id=\"sleeping\"", "איפה תשנו?", "חדר שינה אחד", "מיטה זוגית"] }),

  html({ checkId: "world.vacations.semantic", family: "world-landings", world: "vacations", route: "/search", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Vacation results keep the server-rendered search shell and controls; hydrated cards are covered by browser QA and catalog probes", releaseBlocking: true, requiredAll: ["<main", "results-list"] }),
  html({ checkId: "world.events.semantic", family: "world-landings", world: "events", route: "/events", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Events landing renders cards and search controls", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd", "\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05dc\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd"] }),
  html({ checkId: "world.events.region.north.semantic", family: "world-landings", world: "events", route: "/events/search/north", viewport: "desktop", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Approved regional event landing resolves to its real result page", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05dc\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d1\u05e6\u05e4\u05d5\u05df", "Event venues in the north"] }),
  html({ checkId: "world.hourly.semantic", family: "world-landings", world: "hourly", route: "/hourly", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Hourly landing renders cards and filters", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d7\u05d3\u05e8\u05d9\u05dd \u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4", "\u05e9\u05d4\u05d9\u05d9\u05d4 \u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4"] }),
  html({ checkId: "world.spas.semantic", family: "world-landings", world: "spa", route: "/spas", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Spa landing renders packages or spa cards", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05e1\u05e4\u05d0", "\u05d7\u05d1\u05d9\u05dc\u05d5\u05ea"] }),
  html({ checkId: "world.attractions.semantic", family: "world-landings", world: "activities", route: "/attractions", viewport: "mobile", severity: "high", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Attractions landing renders paid experience cards", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d0\u05d8\u05e8\u05e7\u05e6\u05d9\u05d5\u05ea", "\u05d7\u05d5\u05d5\u05d9\u05d5\u05ea"] }),

  html({ checkId: "place.event.semantic", family: "place-pages", world: "events", route: "/events/place/event-2", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Event place contains gallery, contacts, reviews and booking inquiry", releaseBlocking: true, requiredAll: ["property-gallery", "tel:", "\u05d7\u05d5\u05d5\u05ea \u05d3\u05e2\u05ea", "event-booking"] }),
  html({ checkId: "place.hourly.semantic", family: "place-pages", world: "hourly", route: "/discover/place/hourly-475", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Hourly place contains gallery, contacts and location", releaseBlocking: true, requiredAll: ["tel:", "\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4", "WhatsApp", "\u05db\u05e0\u05d9\u05e1\u05d4 \u05d3\u05d9\u05e1\u05e7\u05e8\u05d8\u05d9\u05ea"] }),
  html({ checkId: "place.spa.semantic", family: "place-pages", world: "spa", route: "/discover/place/spa-6", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Spa place contains gallery or packages and location", releaseBlocking: true, requiredAll: ["\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d7\u05d1\u05d9\u05dc\u05d5\u05ea", "\u05d8\u05d9\u05e4\u05d5\u05dc\u05d9\u05dd", "\u05d2\u05dc\u05e8"] }),
  html({ checkId: "world.trails.semantic", family: "world-landings", world: "trails", route: "/trails", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Trails explorer renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05d8\u05d9\u05d5\u05dc\u05d9\u05dd", "\u05de\u05e1\u05dc\u05d5\u05dc\u05d9\u05dd"] }),
  html({ checkId: "world.providers.semantic", family: "world-landings", world: "providers", route: "/providers", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Providers catalog renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e1\u05e4\u05e7\u05d9\u05dd", "\u05e9\u05d9\u05e8\u05d5\u05ea\u05d9\u05dd"] }),
  html({ checkId: "world.holidays.semantic", family: "editorial-landings", world: "vacations", route: "/holidays", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Holiday index renders future holiday links", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05d7\u05d2\u05d9\u05dd", "\u05e0\u05d5\u05e4\u05e9"] }),
  html({ checkId: "world.last-minute.semantic", family: "editorial-landings", world: "vacations", route: "/last-minute", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Last-minute permanent landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e8\u05d2\u05e2 \u05d4\u05d0\u05d7\u05e8\u05d5\u05df", "\u05e0\u05d5\u05e4\u05e9"] }),
  html({ checkId: "world.events.last-minute.semantic", family: "editorial-landings", world: "events", route: "/events/last-minute", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Last-minute event landing renders verified offers", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d1\u05e8\u05d2\u05e2 \u05d4\u05d0\u05d7\u05e8\u05d5\u05df", "Last-minute events"] }),
  html({ checkId: "world.events.thursday.semantic", family: "editorial-landings", world: "events", route: "/events/thursday", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Thursday event landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["אירועים פנויים לחמישי", "Events available Thursday"] }),
  html({ checkId: "world.events.friday.semantic", family: "editorial-landings", world: "events", route: "/events/friday", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Friday event landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["אירועים פנויים לשישי", "Events available Friday"] }),
  html({ checkId: "world.spas.today.semantic", family: "editorial-landings", world: "spa", route: "/spas/today", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Today spa landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e1\u05e4\u05d0 \u05dc\u05d4\u05d9\u05d5\u05dd", "Spa today"] }),
  html({ checkId: "world.spas.tomorrow.semantic", family: "editorial-landings", world: "spa", route: "/spas/tomorrow", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Tomorrow spa landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e1\u05e4\u05d0 \u05dc\u05de\u05d7\u05e8", "Spa tomorrow"] }),

  json({ checkId: "map.snapshot.vacation", family: "maps", world: "vacations", route: "/api/map-health?world=vacation&id=vacation-116", severity: "critical", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Vacation place has valid coordinates and a real interactive map path", releaseBlocking: true, requiredAll: ["\"coordinatesReady\":true", "\"interactiveMap\":true"] }),
  json({ checkId: "map.snapshot.event", family: "maps", world: "events", route: "/api/map-health?world=events&id=event-2", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Event place has valid coordinates and a real interactive map path", releaseBlocking: true, requiredAll: ["\"coordinatesReady\":true", "\"interactiveMap\":true"] }),
  json({ checkId: "map.snapshot.hourly", family: "maps", world: "hourly", route: "/api/map-health?world=hourly&id=hourly-475", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Hourly place has valid coordinates and a real interactive map path", releaseBlocking: true, requiredAll: ["\"coordinatesReady\":true", "\"interactiveMap\":true"] }),
  json({ checkId: "map.snapshot.spa", family: "maps", world: "spa", route: "/api/map-health?world=spa&id=spa-6", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Spa place has valid coordinates and a real interactive map path", releaseBlocking: true, requiredAll: ["\"coordinatesReady\":true", "\"interactiveMap\":true"] }),

  json({ checkId: "api.catalog.vacations", family: "catalog-apis", world: "vacations", route: "/api/catalog?world=vacations&view=search", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Vacation search catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"vacations\"", "\"entries\":"] }),
  json({ checkId: "api.vacation.amenity-groups", family: "place-pages", world: "vacations", route: "/api/vii/business-amenities?id=2483&v=3", severity: "critical", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Vacation place amenities preserve the official Biz groups or exact legacy VII place groups when Biz detail is empty", releaseBlocking: true, requiredAll: ["\"groups\":[", "מתחם חיצוני", "מתחם פנימי"] }),
  json({ checkId: "api.catalog.events", family: "catalog-apis", world: "events", route: "/api/catalog?world=events&view=search", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Event search catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"events\"", "\"entries\":"] }),
  json({ checkId: "api.catalog.hourly", family: "catalog-apis", world: "hourly", route: "/api/catalog?world=rooms", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Hourly catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"rooms\"", "\"entries\":"] }),
  json({ checkId: "api.catalog.spa", family: "catalog-apis", world: "spa", route: "/api/catalog?world=spa", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Spa catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"spa\"", "\"entries\":"] }),
  json({ checkId: "api.home.presentation", family: "home-sliders", world: "all", route: "/api/vii/homepage-presentation", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Home discovery presentation returns every managed collection used by the public home", releaseBlocking: true, requiredAll: ["\"popular\":", "\"cities\":", "\"types\":"] }),
  json({ checkId: "api.starting-prices", family: "pricing", world: "vacations", route: "/api/vii/starting-prices?world=vacations", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Starting-price cache returns JSON", releaseBlocking: true, requiredAny: ["prices", "vacation-"] }),
  json({ checkId: "api.reviews.read", family: "reviews", world: "vacations", route: "/api/reviews?subjectId=vacation-116", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Review read API returns the authenticated single-review contract", releaseBlocking: false, requiredAll: ["\"review\":", "\"authenticated\":"] }),

  html({ checkId: "content.guides", family: "content-pages", world: "all", route: "/guides", viewport: "desktop", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Guides index renders", releaseBlocking: false, requiredAll: ["<main"] }),
  html({ checkId: "content.questions", family: "content-pages", world: "all", route: "/questions", viewport: "desktop", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Questions page renders", releaseBlocking: false, requiredAll: ["<main"], requiredAny: ["\u05e9\u05d0\u05dc\u05d5\u05ea", "\u05ea\u05e9\u05d5\u05d1\u05d5\u05ea"] }),
  html({ checkId: "content.contact", family: "content-pages", world: "all", route: "/contact", viewport: "mobile", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Business publishing and joining page renders at the retained contact route", releaseBlocking: false, requiredAll: ["<main"], requiredAny: ["\u05de\u05e6\u05d8\u05e8\u05e4\u05d9\u05dd", "\u05e4\u05e8\u05e1\u05d5\u05dd \u05e2\u05e1\u05e7"] }),
  html({ checkId: "legal.terms", family: "public-trust", world: "all", route: "/legal/terms", viewport: "server", severity: "high", cadenceMinutes: 1440, timeoutMs: 10_000, expected: "Terms page renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05ea\u05e7\u05e0\u05d5\u05df", "\u05ea\u05e0\u05d0\u05d9 \u05e9\u05d9\u05de\u05d5\u05e9"] }),
  html({ checkId: "legal.privacy", family: "public-trust", world: "all", route: "/legal/privacy", viewport: "server", severity: "high", cadenceMinutes: 1440, timeoutMs: 10_000, expected: "Privacy page renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea", "\u05de\u05d9\u05d3\u05e2"] }),
  { checkId: "seo.sitemap.xml", family: "seo-legacy", world: "all", route: "/sitemap.xml", viewport: "server", severity: "high", cadenceMinutes: 360, timeoutMs: 45_000, expected: "Sitemap index returns populated XML and delegates to section maps", releaseBlocking: true, contentKind: "xml", minBytes: 500, requiredAll: ["<sitemapindex", "<loc>"], requiredAny: ["/sitemaps/core/", "/sitemaps/vacations/"] },
  ...(["core", "holidays", "vacations", "events", "spas", "hourly", "discovery", "search-pages"] as const).map((section): QualityCheck => ({
    checkId: `seo.sitemap.${section}`, family: "seo-legacy", world: "all", route: `/sitemaps/${section}/1.xml`, viewport: "server",
    severity: "high", cadenceMinutes: 360, timeoutMs: 45_000, expected: `${section} sitemap returns a populated URL set`,
    releaseBlocking: true, contentKind: "xml", minBytes: 200, requiredAll: ["<urlset", "<loc>"],
  })),
  ...discoveryReadinessDefinitions.map(({checkId,world,route})=>json({checkId,world,route,family:'discovery-readiness',severity:'critical',cadenceMinutes:30,timeoutMs:10_000,expected:'Current exposed preset has a verified accepted snapshot, including a genuinely empty supplier result',releaseBlocking:true,semanticContract:DISCOVERY_READINESS_VERSION})),
] as const;

export function qualityHeartbeatWindow(now = new Date()) {
  return new Date(Math.floor(now.getTime() / 300_000) * 300_000);
}

export function shouldStartQualityHeartbeat(request: Request) {
  if (request.method !== "GET") return false;
  if ((request.headers.get("user-agent") || "").includes("VII-Quality-Monitor/")) return false;
  return (request.headers.get("accept") || "").includes("text/html");
}

const schema = [
  `CREATE TABLE IF NOT EXISTS quality_checks (
    check_id TEXT PRIMARY KEY, family TEXT NOT NULL, world TEXT NOT NULL, route TEXT NOT NULL,
    viewport TEXT NOT NULL, severity TEXT NOT NULL, cadence_minutes INTEGER NOT NULL,
    timeout_ms INTEGER NOT NULL, expected TEXT NOT NULL, release_blocking INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quality_runs (
    id TEXT PRIMARY KEY, operation_key TEXT NOT NULL UNIQUE, trigger_kind TEXT NOT NULL, release_id TEXT, status TEXT NOT NULL,
    started_at TEXT NOT NULL, finished_at TEXT, passed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0, degraded_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER, actor TEXT,
    total_checks INTEGER NOT NULL DEFAULT 0, current_check_id TEXT)`,
  `CREATE INDEX IF NOT EXISTS quality_runs_started ON quality_runs(started_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_results (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, check_id TEXT NOT NULL, status TEXT NOT NULL,
    status_code INTEGER, duration_ms INTEGER NOT NULL, observed TEXT NOT NULL, evidence_url TEXT,
    checked_at TEXT NOT NULL, UNIQUE(run_id,check_id))`,
  `CREATE INDEX IF NOT EXISTS quality_results_run ON quality_results(run_id,checked_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_job_projection_receipts (result_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,applied_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS quality_job_projection_runs ON quality_job_projection_receipts(run_id)`,
  `CREATE TABLE IF NOT EXISTS quality_notification_outbox (id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS quality_notification_outbox_due ON quality_notification_outbox(status,created_at)`,
  `CREATE TABLE IF NOT EXISTS quality_incidents (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, check_id TEXT NOT NULL, family TEXT NOT NULL,
    world TEXT NOT NULL, route TEXT NOT NULL, viewport TEXT NOT NULL, severity TEXT NOT NULL,
    status TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
    recovered_at TEXT, acknowledged_at TEXT, acknowledged_by TEXT, resolved_at TEXT,
    resolved_by TEXT, occurrences INTEGER NOT NULL DEFAULT 1, cycle INTEGER NOT NULL DEFAULT 1, last_result_id TEXT NOT NULL,
    last_observed TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS quality_incidents_status ON quality_incidents(status,severity,last_seen_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_notification_deliveries (
    id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, channel TEXT NOT NULL, event_kind TEXT NOT NULL,
    status TEXT NOT NULL, provider_message_id TEXT, reason TEXT, created_at TEXT NOT NULL,
    UNIQUE(incident_id,channel,event_kind))`,
  `CREATE TABLE IF NOT EXISTS quality_schedule_overrides (
    check_id TEXT PRIMARY KEY, cadence_minutes INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
] as const;

export async function ensureQualitySchema(db: D1Database) {
  return initializeSchemaOnce(db, "quality-schema-job-outbox-v4", async () => {
  await db.batch(schema.map((statement) => db.prepare(statement)));
  const columns = await db.prepare(`PRAGMA table_info(quality_runs)`).all<{ name: string }>();
  const names = new Set((columns.results || []).map((column) => column.name));
  if (!names.has("total_checks")) await db.prepare(`ALTER TABLE quality_runs ADD COLUMN total_checks INTEGER NOT NULL DEFAULT 0`).run();
  if (!names.has("current_check_id")) await db.prepare(`ALTER TABLE quality_runs ADD COLUMN current_check_id TEXT`).run();
  const incidentColumns = await db.prepare(`PRAGMA table_info(quality_incidents)`).all<{ name: string }>();
  if (!(incidentColumns.results || []).some((column) => column.name === "cycle")) await db.prepare(`ALTER TABLE quality_incidents ADD COLUMN cycle INTEGER NOT NULL DEFAULT 1`).run();
  });
}

function fingerprint(check: QualityCheck) {
  return `production:${check.checkId}:${check.family}:${check.world}:${check.route}:${check.viewport}`;
}

export function incidentTransition(previous: { status: string; occurrences: number } | null, result: QualityStatus) {
  if (result === "passed") return previous ? { action: "recover" as const, occurrences: previous.occurrences } : { action: "none" as const, occurrences: 0 };
  return previous && previous.status !== "resolved" ? { action: "update" as const, occurrences: previous.occurrences + 1 } : { action: "open" as const, occurrences: 1 };
}

async function registerChecks(db: D1Database, now: string) {
  await db.batch(qualityRegistry.map((check) => db.prepare(`INSERT INTO quality_checks
    (check_id,family,world,route,viewport,severity,cadence_minutes,timeout_ms,expected,release_blocking,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(check_id) DO UPDATE SET family=excluded.family,world=excluded.world,
    route=excluded.route,viewport=excluded.viewport,severity=excluded.severity,cadence_minutes=excluded.cadence_minutes,
    timeout_ms=excluded.timeout_ms,expected=excluded.expected,release_blocking=excluded.release_blocking,active=1,updated_at=excluded.updated_at`)
    .bind(check.checkId, check.family, check.world, check.route, check.viewport, check.severity,
      check.cadenceMinutes, check.timeoutMs, check.expected, check.releaseBlocking ? 1 : 0, now)));
  await db.prepare(`UPDATE quality_checks SET cadence_minutes=(SELECT cadence_minutes FROM quality_schedule_overrides WHERE check_id=quality_checks.check_id)
    WHERE check_id IN (SELECT check_id FROM quality_schedule_overrides)`).run();
}

async function checksDue(db: D1Database, now: Date, trigger: "scheduled" | "manual", level: QualityRunLevel = "full") {
  if (trigger === "manual") {
    if (level === "regular") return qualityRegistry.filter((check) => check.severity === "critical");
    if (level === "medium") return qualityRegistry.filter((check) => check.severity === "critical" || check.severity === "high");
    return [...qualityRegistry];
  }
  const minute = Math.floor(now.getTime() / 60_000);
  const overrides = await db.prepare(`SELECT check_id AS checkId,cadence_minutes AS cadenceMinutes FROM quality_schedule_overrides`).all<{ checkId: string; cadenceMinutes: number }>();
  const cadenceById = new Map((overrides.results || []).map((row) => [row.checkId, row.cadenceMinutes]));
  return qualityRegistry.filter((check) => minute % (cadenceById.get(check.checkId) || check.cadenceMinutes) === 0);
}

export async function executeQualityCheck(check: QualityCheck, origin: string, fetcher: typeof fetch, signal?: AbortSignal) {
  const started = Date.now();
  const probe=discoveryReadinessProbe(check.checkId,new Date(started));
  const url = new URL(check.route, origin).toString();
  if((Boolean(probe)!==Boolean(check.semanticContract))||probe&&(check.semanticContract!==DISCOVERY_READINESS_VERSION||check.route!==probe.route))return {status:'blocked' as const,statusCode:null,durationMs:0,observed:'discovery_readiness_contract_mismatch',url};
  try {
    const response = await fetcher(url, {
      method: probe?.method??"GET",
      ...(probe&&'body' in probe?{body:probe.body}:{}),
      redirect: "follow",
      headers: { "user-agent": "VII-Quality-Monitor/2.0", ...(probe?.method==='POST'?{'Content-Type':'application/json'}:{}), accept: check.contentKind === "image" ? "image/avif,image/webp,image/png,image/jpeg" : check.contentKind === "json" ? "application/json" : check.contentKind === "xml" ? "application/xml,text/xml" : "text/html" },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(check.timeoutMs)]) : AbortSignal.timeout(check.timeoutMs),
    });
    const type = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = check.contentKind === "image" ? "" : new TextDecoder().decode(bytes);
    const expectedType = check.contentKind === "image" ? /^image\/(?:avif|webp|png|jpeg)/i.test(type)
      : check.contentKind === "json" ? /json/i.test(type) && (() => { try { JSON.parse(body); return true; } catch { return false; } })()
      : check.contentKind === "xml" ? /xml/i.test(type) || /^\s*<\?xml|<urlset|<sitemapindex/i.test(body)
      : /html/i.test(type) || /<!doctype html|<html/i.test(body);
    const missingAll = (check.requiredAll || []).filter((token) => !body.includes(token));
    const hasAny = !check.requiredAny?.length || check.requiredAny.some((token) => body.includes(token));
    const forbidden = (check.forbidden || []).filter((token) => body.includes(token));
    const readiness=probe?(()=>{try{return probe.validate(JSON.parse(body),Date.now());}catch{return {ok:false,reason:'invalid_snapshot_json'};}})():{ok:true};
    const passed = response.status >= 200 && response.status < 400 && expectedType && bytes.byteLength >= (check.minBytes || 256)
      && missingAll.length === 0 && hasAny && forbidden.length === 0 && readiness.ok;
    const assertions = [
      missingAll.length ? `missing:${missingAll.join("|")}` : null,
      !hasAny ? `missing-any:${check.requiredAny?.join("|")}` : null,
      forbidden.length ? `forbidden:${forbidden.join("|")}` : null,
      !readiness.ok&&'reason' in readiness?`snapshot:${readiness.reason}`:null,
    ].filter(Boolean).join("; ");
    return { status: passed ? "passed" as const : "failed" as const, statusCode: response.status,
      durationMs: Date.now() - started, observed: `${response.status} ${type || "unknown"}; ${bytes.byteLength} bytes${assertions ? `; ${assertions}` : ""}`, url };
  } catch (error) {
    return { status: "failed" as const, statusCode: null, durationMs: Date.now() - started,
      observed: error instanceof Error ? error.message.slice(0, 500) : "unknown fetch failure", url };
  }
}

export function selectManualQualityChecks(level: QualityRunLevel, scope?: { changedBoxes: readonly string[]; consumers?: readonly string[]; unknownOwner?: boolean }) {
  let checks = qualityRegistry.filter(check => level === "full" || check.severity === "critical" || level === "medium" && check.severity === "high");
  if (scope) {
    const selected = selectQualityScope(adaptQualityChecks(qualityRegistry, qualityScopeMetadata), scope.changedBoxes, scope);
    if (selected.status !== "selected") throw new Error("quality_scope_unmapped");
    checks = checks.filter(check => selected.selectedCheckIds.includes(check.checkId));
    if (checks.length !== selected.selectedCheckIds.length) throw new Error("quality_scope_level_incomplete");
  }
  if (!checks.length) throw new Error("quality_scope_empty");
  return checks;
}

export function readQualityScopeOptions() {
  const metadata = Object.fromEntries(adaptQualityChecks(qualityRegistry, qualityScopeMetadata).map(check => [check.checkId, {
    ...qualityScopeMetadata[check.checkId], costBudgetMs: check.timeoutMs,
  }]));
  const boxes = [...new Set(Object.values(metadata).flatMap(entry => entry.boxIds))].sort();
  const scopes = Object.fromEntries(boxes.map(box => [box, Object.fromEntries((["regular", "medium", "full"] as const).map(level => {
    try { return [level, { supported: true, checkIds: selectManualQualityChecks(level, { changedBoxes: [box] }).map(check => check.checkId) }]; }
    catch { return [level, { supported: false, checkIds: [] }]; }
  }))]));
  return { metadata, boxes, scopes };
}

function emailConfiguration(env: QualityNotificationEnvironment = {}) {
  const provider = (env.VII_QUALITY_EMAIL_PROVIDER || "").trim().toLowerCase();
  const apiKey = (env.VII_QUALITY_EMAIL_API_KEY || "").trim();
  const from = (env.VII_QUALITY_EMAIL_FROM || "").trim();
  const recipients = (env.VII_QUALITY_EMAIL_RECIPIENTS || "").split(",").map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  const supported = provider === "resend";
  return { provider, apiKey, from, recipients, configured: supported && Boolean(apiKey && from && recipients.length) };
}

export function qualityNotificationProviderStatus(env: QualityNotificationEnvironment = {}) {
  const configuration = emailConfiguration(env);
  if (!configuration.provider) return "not_configured";
  if (configuration.provider !== "resend") return "unsupported_provider";
  return configuration.configured ? "configured" : "incomplete_configuration";
}

async function deliverIncidentEmail(event: QualityIncidentEvent, env: QualityNotificationEnvironment, fetcher: typeof fetch) {
  const configuration = emailConfiguration(env);
  if (!configuration.configured) return { status: "disabled", providerMessageId: null, reason: qualityNotificationProviderStatus(env) };
  const recovered = event.eventKind === "recovered";
  const subject = recovered ? `[V QA] נפתרה תקלה: ${event.check.checkId}` : `[V QA] תקלה חדשה: ${event.check.checkId}`;
  const dashboardUrl = new URL("/admin/quality", event.origin).toString();
  const text = [
    recovered ? "תקלה אוטומטית נפתרה בבדיקה חוזרת." : "בדיקת איכות אוטומטית זיהתה תקלה חדשה.",
    `בדיקה: ${event.check.checkId}`,
    `חומרה: ${event.check.severity}`,
    `עולם: ${event.check.world}`,
    `כתובת: ${new URL(event.check.route, event.origin).toString()}`,
    `תוצאה: ${event.observed}`,
    `מערכת ניהול: ${dashboardUrl}`,
  ].join("\n");
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `vii-quality:${event.incidentId}:${event.eventKind}${event.cycle > 1 ? `:${event.cycle}` : ""}` },
      body: JSON.stringify({ from: configuration.from, to: configuration.recipients, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null) as { id?: unknown; message?: unknown } | null;
    const providerMessageId = typeof payload?.id === "string" ? payload.id : null;
    if (!response.ok || !providerMessageId) return { status: "failed", providerMessageId: null, reason: `provider_http_${response.status}` };
    return { status: "sent", providerMessageId, reason: null };
  } catch (error) {
    // A transport timeout or disconnect does not prove provider rejection.
    // Keep the delivery state explicitly uncertain so an operator can decide
    // whether to reconcile or retry without treating it as a verified failure.
    return { status: "unknown", providerMessageId: null, reason: error instanceof Error ? error.message.slice(0, 160) : "provider_request_unknown" };
  }
}

async function recordNotification(db: D1Database, event: QualityIncidentEvent, env: QualityNotificationEnvironment, fetcher: typeof fetch, now: string) {
  const eventKey = event.cycle > 1 ? `${event.eventKind}:${event.cycle}` : event.eventKind;
  const providerStatus = qualityNotificationProviderStatus(env);
  if (providerStatus !== "configured") {
    // Persist the disabled state for visibility, but do not consume the
    // reservation. Once configuration is added, that row can be promoted
    // exactly once and a provider request can begin.
    await db.prepare(`INSERT INTO quality_notification_deliveries
      (id,incident_id,channel,event_kind,status,provider_message_id,reason,created_at)
      VALUES (?,?,'email',?,'disabled',NULL,?,?) ON CONFLICT(incident_id,channel,event_kind) DO NOTHING`)
      .bind(crypto.randomUUID(), event.incidentId, eventKey, providerStatus, now).run();
    return;
  }
  const existingPending = await db.prepare(`SELECT id,status,created_at AS createdAt FROM quality_notification_deliveries
    WHERE incident_id=? AND channel='email' AND event_kind=?`).bind(event.incidentId, eventKey).first<{ id: string; status: string; createdAt: string }>();
  if (existingPending?.status === "pending") {
    if (Date.parse(now) - Date.parse(existingPending.createdAt) >= RUN_STALE_AFTER_MS) {
      await db.prepare(`UPDATE quality_notification_deliveries SET status='unknown',reason='orphaned_reservation',created_at=? WHERE id=? AND status='pending'`)
        .bind(now, existingPending.id).run();
    }
    return;
  }
  // Reserve before the provider request. A SELECT-then-send sequence allows
  // two workers to send the same incident notification concurrently.
  const reservationId = crypto.randomUUID();
  const reservation = await db.prepare(`INSERT INTO quality_notification_deliveries
    (id,incident_id,channel,event_kind,status,provider_message_id,reason,created_at)
    VALUES (?,?,'email',?,'pending',NULL,'reservation',?) ON CONFLICT(incident_id,channel,event_kind) DO NOTHING`)
    .bind(reservationId, event.incidentId, eventKey, now).run();
  let ownedReservationId = Number(reservation.meta?.changes || 0) > 0 ? reservationId : null;
  if (!ownedReservationId) {
    const promoted = await db.prepare(`UPDATE quality_notification_deliveries SET status='pending',provider_message_id=NULL,reason='reservation',created_at=?
      WHERE incident_id=? AND channel='email' AND event_kind=? AND status='disabled'`)
      .bind(now, event.incidentId, eventKey).run();
    if (Number(promoted.meta?.changes || 0) === 0) return;
    const row = await db.prepare(`SELECT id FROM quality_notification_deliveries WHERE incident_id=? AND channel='email' AND event_kind=? AND status='pending'`)
      .bind(event.incidentId, eventKey).first<{ id: string }>();
    ownedReservationId = row?.id || null;
  }
  if (!ownedReservationId) return;
  const delivery = await deliverIncidentEmail(event, env, fetcher);
  await db.prepare(`UPDATE quality_notification_deliveries SET status=?,provider_message_id=?,reason=?,created_at=? WHERE id=?`)
    .bind(delivery.status, delivery.providerMessageId, delivery.reason, now, ownedReservationId).run();
}

async function reconcileIncident(db: D1Database, check: QualityCheck, result: { id: string; status: QualityStatus; observed: string }, now: string,
  options: { origin: string; notificationEnv: QualityNotificationEnvironment; fetcher: typeof fetch; runId: string; deferNotifications?: boolean }) {
  const notify = async (event: QualityIncidentEvent) => {
    if (!options.deferNotifications) return recordNotification(db, event, options.notificationEnv, options.fetcher, now);
    // Persist an outbox event with the incident before the projection receipt.
    // Public/HTTP job slices never wait for an external email provider.
    await db.prepare(`INSERT OR IGNORE INTO quality_notification_outbox (id,payload_json,status,created_at,updated_at)
      VALUES (?,?,'queued',?,?)`).bind(`${event.incidentId}:${event.eventKind}:${event.cycle}`, JSON.stringify(event), now, now).run();
  };
  if (result.status === "passed") {
    // Recovery belongs to the exact check context. A check id can be reused
    // across routes or viewports; recovering every incident with that id can
    // silently close a still-broken sibling context.
    const unresolved = await db.prepare(`SELECT id,cycle,status FROM quality_incidents
      WHERE check_id=? AND family=? AND world=? AND route=? AND viewport=? AND last_seen_at<=?
      AND (status!='resolved' OR last_result_id=?)`)
      .bind(check.checkId, check.family, check.world, check.route, check.viewport, now, result.id).all<{ id: string; cycle: number; status: string }>();
    for (const incident of unresolved.results || []) {
      if (incident.status === "resolved") {
        await notify({ incidentId: incident.id, cycle: Number(incident.cycle || 1), eventKind: "recovered", check, observed: result.observed, origin: options.origin });
        continue;
      }
      const updated = await db.prepare(`UPDATE quality_incidents SET status='resolved',last_seen_at=?,recovered_at=?,resolved_at=?,resolved_by='automatic-recovery',last_result_id=?,last_observed=?
        WHERE id=? AND EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
        .bind(now, now, now, result.id, result.observed, incident.id, options.runId).run();
      if (Number(updated.meta?.changes || 0) > 0) await notify({ incidentId: incident.id, cycle: Number(incident.cycle || 1), eventKind: "recovered", check, observed: result.observed, origin: options.origin });
    }
    return;
  }
  const key = fingerprint(check);
  const prior = await db.prepare(`SELECT id,status,occurrences,cycle,last_result_id AS lastResultId,last_seen_at AS lastSeenAt FROM quality_incidents WHERE fingerprint=?`).bind(key)
    .first<{ id: string; status: string; occurrences: number; cycle: number; lastResultId: string; lastSeenAt: string }>();
  if (prior && prior.lastSeenAt > now) return;
  if (prior?.lastResultId === result.id) {
    if (prior.occurrences === 1 && prior.status !== "resolved") await notify({ incidentId: prior.id, cycle: Number(prior.cycle || 1), eventKind: "opened", check, observed: result.observed, origin: options.origin });
    return;
  }
  const transition = incidentTransition(prior, result.status);
  if (transition.action === "none") return;
  if (transition.action === "open") {
    if (prior) {
      const reopened = await db.prepare(`UPDATE quality_incidents SET status='open',last_seen_at=?,recovered_at=NULL,resolved_at=NULL,resolved_by=NULL,occurrences=1,cycle=cycle+1,last_result_id=?,last_observed=?
        WHERE id=? AND status='resolved' AND EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
        .bind(now, result.id, result.observed, prior.id, options.runId).run();
      if (Number(reopened.meta?.changes || 0) > 0) await notify({ incidentId: prior.id, cycle: Number(prior.cycle || 1) + 1, eventKind: "opened", check, observed: result.observed, origin: options.origin });
      return;
    }
    const incidentId = crypto.randomUUID();
    const inserted = await db.prepare(`INSERT INTO quality_incidents
      (id,fingerprint,check_id,family,world,route,viewport,severity,status,first_seen_at,last_seen_at,recovered_at,
       acknowledged_at,acknowledged_by,resolved_at,resolved_by,occurrences,cycle,last_result_id,last_observed)
      SELECT ?,?,?,?,?,?,?,?, 'open',?,?,NULL,NULL,NULL,NULL,NULL,1,1,?,?
      WHERE EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
      .bind(incidentId, key, check.checkId, check.family, check.world, check.route, check.viewport, check.severity, now, now, result.id, result.observed, options.runId).run();
    if (Number(inserted.meta?.changes || 0) > 0) await notify({ incidentId, cycle: 1, eventKind: "opened", check, observed: result.observed, origin: options.origin });
    return;
  }
  await db.prepare(`UPDATE quality_incidents SET status='open',last_seen_at=?,recovered_at=NULL,resolved_at=NULL,resolved_by=NULL,
    occurrences=?,last_result_id=?,last_observed=? WHERE fingerprint=? AND EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
    .bind(now, transition.occurrences, result.id, result.observed, key, options.runId).run();
}

export async function runQualityChecks(db: D1Database, options: {
  origin: string; trigger: "scheduled" | "manual"; scheduledAt?: Date; releaseId?: string; actor?: string; fetcher?: typeof fetch;
  notificationEnv?: QualityNotificationEnvironment; level?: QualityRunLevel;
  scope?: { changedBoxes: readonly string[]; consumers?: readonly string[]; unknownOwner?: boolean };
}) {
  const nowDate = options.scheduledAt || new Date();
  const now = nowDate.toISOString();
  const runId = crypto.randomUUID();
  const level = options.level || "full";
  const operationKey = options.trigger === "scheduled"
    ? `scheduled:${Math.floor(nowDate.getTime() / 300_000)}`
    : `manual:${level}:${runId}`;
  const started = Date.now();
  await ensureQualitySchema(db);
  const staleBefore = new Date(nowDate.getTime() - RUN_STALE_AFTER_MS).toISOString();
  // Never reclaim a possibly sent reservation. Make an orphaned pending row
  // visible as uncertain; only an operator/reconciliation flow may decide on
  // any later action.
  await db.prepare(`UPDATE quality_notification_deliveries SET status='unknown',reason='orphaned_reservation',created_at=?
    WHERE status='pending' AND created_at<?`).bind(now, staleBefore).run();
  await db.prepare(`UPDATE quality_runs SET status='blocked',finished_at=?,duration_ms=?,
    blocked_count=CASE WHEN blocked_count<1 THEN 1 ELSE blocked_count END
    WHERE status='running' AND started_at<?`).bind(now, RUN_STALE_AFTER_MS, staleBefore).run();
  await registerChecks(db, now);
  let due = await checksDue(db, nowDate, options.trigger, level);
  let scopeSelection: QualityScopeSelection | null = null;
  let expectedCheckIds: readonly string[] | undefined;
  if (options.scope) {
    scopeSelection = selectQualityScope(adaptQualityChecks(qualityRegistry, qualityScopeMetadata), options.scope.changedBoxes, options.scope);
    if (scopeSelection.status !== "selected") return { runId: null, status: "blocked" as const, counts: { passed: 0, failed: 0, degraded: 0, blocked: 1 }, checkCount: 0, expectedCheckIds: scopeSelection.selectedCheckIds, executedCheckIds: [], selectedCheckIds: scopeSelection.selectedCheckIds, selectionStatus: scopeSelection.status, startedAt: now, finishedAt: now };
    expectedCheckIds = scopeSelection.selectedCheckIds;
    due = due.filter((check) => scopeSelection!.selectedCheckIds.includes(check.checkId));
    if (due.length !== expectedCheckIds.length) return { runId: null, status: "blocked" as const, counts: { passed: 0, failed: 0, degraded: 0, blocked: 1 }, checkCount: due.length, expectedCheckIds, executedCheckIds: [], selectedCheckIds: scopeSelection.selectedCheckIds, selectionStatus: "selected", startedAt: now, finishedAt: now };
  }
  const triggerKind = options.trigger === "manual" ? `manual_${level}` : options.trigger;
  await db.prepare(`INSERT INTO quality_runs (id,operation_key,trigger_kind,release_id,status,started_at,actor,total_checks,current_check_id) VALUES (?,?,?,?,'running',?,?,?,?)
    ON CONFLICT(operation_key) DO NOTHING`).bind(runId, operationKey, triggerKind, options.releaseId || null, now, options.actor || null, due.length, due[0]?.checkId || null).run();
  const claimed = await db.prepare(`SELECT id,status FROM quality_runs WHERE operation_key=?`).bind(operationKey).first<{ id: string; status: string }>();
  if (!claimed || claimed.id !== runId) return { runId: claimed?.id || null, status: "skipped" as const, counts: null, checkCount: 0, startedAt: now, finishedAt: null };
  const counts = { passed: 0, failed: 0, degraded: 0, blocked: 0 };
  // An empty selection is an incomplete run, never a green run. This can
  // happen after an invalid schedule override or a clock/configuration gap.
  if (due.length === 0) {
    counts.blocked = 1;
    const finished = new Date().toISOString();
    await db.prepare(`UPDATE quality_runs SET status='blocked',finished_at=?,total_checks=0,current_check_id=NULL,blocked_count=1,duration_ms=? WHERE id=? AND status='running'`)
      .bind(finished, Date.now() - started, runId).run();
    return { runId, status: "blocked" as const, counts, checkCount: 0, expectedCheckIds: scopeSelection?.selectedCheckIds || [], executedCheckIds: [], selectedCheckIds: scopeSelection?.selectedCheckIds || [], selectionStatus: scopeSelection?.status || "selected", startedAt: now, finishedAt: finished };
  }
  const fetcher = options.fetcher || fetch;
  for (let offset = 0; offset < due.length; offset += CHECK_CONCURRENCY) {
    const batch = due.slice(offset, offset + CHECK_CONCURRENCY);
    await db.prepare(`UPDATE quality_runs SET current_check_id=? WHERE id=? AND status='running'`)
      .bind(batch[0]?.checkId || null, runId).run();
    const observations = await Promise.all(batch.map(async (check) => ({ check, observed: await executeQualityCheck(check, options.origin, fetcher) })));
    // A stale-run sweeper may have claimed this run while the network batch
    // was in flight. Do not append results, reconcile incidents, or publish a
    // late green status after ownership has been lost.
    const active = await db.prepare(`SELECT status FROM quality_runs WHERE id=?`).bind(runId).first<{ status: string }>();
    if (active?.status !== "running") {
      counts.blocked += 1;
      return { runId, status: "blocked" as const, counts, checkCount: due.length, expectedCheckIds: scopeSelection?.selectedCheckIds || [], executedCheckIds: [], selectedCheckIds: scopeSelection?.selectedCheckIds || [], selectionStatus: scopeSelection?.status || "selected", startedAt: now, finishedAt: new Date().toISOString() };
    }
    for (const { check, observed } of observations) {
      const resultId = crypto.randomUUID();
      counts[observed.status] += 1;
      const insertedResult = await db.prepare(`INSERT INTO quality_results (id,run_id,check_id,status,status_code,duration_ms,observed,evidence_url,checked_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
        .bind(resultId, runId, check.checkId, observed.status, observed.statusCode,
        observed.durationMs, observed.observed, observed.url, new Date().toISOString(), runId).run();
      if (Number(insertedResult.meta?.changes || 0) === 0) {
        counts.blocked += 1;
        return { runId, status: "blocked" as const, counts, checkCount: due.length, expectedCheckIds: scopeSelection?.selectedCheckIds || [], executedCheckIds: due.map((check) => check.checkId), selectedCheckIds: scopeSelection?.selectedCheckIds || [], selectionStatus: scopeSelection?.status || "selected", startedAt: now, finishedAt: new Date().toISOString() };
      }
      await reconcileIncident(db, check, { id: resultId, status: observed.status, observed: observed.observed }, new Date().toISOString(), {
        origin: options.origin, notificationEnv: options.notificationEnv || {}, fetcher, runId,
      });
    }
    // Persist progress after every bounded batch. The administration screen
    // reads this same run record while the request continues in the worker,
    // so passed/failed/remaining counters never come from a second client-side
    // calculation.
    await db.prepare(`UPDATE quality_runs SET total_checks=?,current_check_id=?,passed_count=?,failed_count=?,degraded_count=?,blocked_count=?,duration_ms=? WHERE id=? AND status='running'`)
      .bind(due.length, due[offset + CHECK_CONCURRENCY]?.checkId || null, counts.passed, counts.failed, counts.degraded, counts.blocked, Date.now() - started, runId).run();
  }
  const finished = new Date().toISOString();
  const status = counts.failed || counts.blocked ? "failed" : counts.degraded ? "degraded" : "passed";
  await db.prepare(`UPDATE quality_runs SET status=?,finished_at=?,total_checks=?,current_check_id=NULL,passed_count=?,failed_count=?,degraded_count=?,blocked_count=?,duration_ms=? WHERE id=? AND status='running'`)
    .bind(status, finished, due.length, counts.passed, counts.failed, counts.degraded, counts.blocked, Date.now() - started, runId).run();
  const persisted = await db.prepare(`SELECT status FROM quality_runs WHERE id=?`).bind(runId).first<{ status: QualityStatus }>();
  return { runId, status: persisted?.status || "blocked", counts, checkCount: due.length, expectedCheckIds: scopeSelection?.selectedCheckIds || [], executedCheckIds: due.map((check) => check.checkId), selectedCheckIds: scopeSelection?.selectedCheckIds || [], selectionStatus: scopeSelection?.status || "selected", startedAt: now, finishedAt: finished };
}

/** Bridge durable manual jobs into the existing run/result/incident history.
 * Stable result IDs and idempotent incident reconciliation make projection
 * resumable without increasing occurrences or repeating a reserved send. */
export async function persistQualityJobProgress(db: D1Database, job: QualityJob, notificationEnv: QualityNotificationEnvironment = {}, fetcher: typeof fetch = fetch) {
  await ensureQualitySchema(db);
  const level = job.checks[0]?.configuration.level;
  const triggerKind = job.checks[0]?.configuration.trigger === "scheduled" ? "scheduled" : level === "regular" ? "manual_regular" : level === "medium" ? "manual_medium" : "manual_full";
  await db.prepare(`INSERT OR IGNORE INTO quality_runs (id,operation_key,trigger_kind,release_id,status,started_at,actor,total_checks,current_check_id)
    VALUES (?,?,?,?,'running',?,?,?,?)`).bind(job.runId, `job:${job.runId}`, triggerKind, job.sourceVersion, job.createdAt, job.actor, job.checks.length, job.checks[job.nextIndex]?.checkId ?? null).run();
  const current = await db.prepare("SELECT status FROM quality_runs WHERE id=?").bind(job.runId).first<{ status: string }>();
  if (current?.status !== "running") return false;
  const counts = { passed: 0, failed: 0, degraded: 0, blocked: 0 };
  const appliedRows = await db.prepare("SELECT result_id AS resultId FROM quality_job_projection_receipts WHERE run_id=?")
    .bind(job.runId).all<{ resultId: string }>();
  const applied = new Set(appliedRows.results.map(row => row.resultId));
  for (const receipt of job.receipts) {
    counts[receipt.status]++;
    const entry = job.checks.find(check => check.checkId === receipt.checkId);
    if (!entry) throw new Error("quality_job_receipt_definition_missing");
    const check = entry.configuration.check as QualityCheck;
    const resultId = `${job.runId}:${receipt.checkId}`;
    if (applied.has(resultId)) continue;
    await db.prepare(`INSERT OR IGNORE INTO quality_results (id,run_id,check_id,status,status_code,duration_ms,observed,evidence_url,checked_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM quality_runs WHERE id=? AND status='running')`)
      .bind(resultId, job.runId, receipt.checkId, receipt.status, receipt.statusCode ?? null, receipt.durationMs ?? 0, receipt.observed, receipt.evidenceUrl ?? null, receipt.checkedAt, job.runId).run();
    await reconcileIncident(db, check, { id: resultId, status: receipt.status, observed: receipt.observed }, receipt.checkedAt,
      { origin: String(entry.configuration.origin), notificationEnv, fetcher, runId: job.runId, deferNotifications: true });
    await db.prepare("INSERT OR IGNORE INTO quality_job_projection_receipts (result_id,run_id,applied_at) VALUES (?,?,?)")
      .bind(resultId, job.runId, new Date().toISOString()).run();
  }
  const terminal = job.status === "completed" || job.status === "blocked" || job.status === "cancelled";
  if (job.status === "blocked" || job.status === "cancelled") counts.blocked++;
  const status = !terminal ? "running" : job.status !== "completed" ? "blocked" : counts.failed || counts.blocked ? "failed" : counts.degraded ? "degraded" : "passed";
  // A completed cursor without every committed receipt is incomplete evidence.
  const safeStatus = status === "passed" && (job.nextIndex !== job.checks.length || job.receipts.length !== job.checks.length) ? "blocked" : status;
  await db.prepare(`UPDATE quality_runs SET status=?,finished_at=?,current_check_id=?,passed_count=?,failed_count=?,degraded_count=?,blocked_count=?,duration_ms=?
    WHERE id=? AND status='running'`).bind(safeStatus, terminal ? job.updatedAt : null, terminal ? null : job.checks[job.nextIndex]?.checkId ?? null,
      counts.passed, counts.failed, counts.degraded, counts.blocked, Math.max(0, Date.parse(job.updatedAt) - Date.parse(job.createdAt)), job.runId).run();
  return true;
}

export async function flushQueuedQualityNotifications(db: D1Database, notificationEnv: QualityNotificationEnvironment, fetcher: typeof fetch = fetch) {
  await ensureQualitySchema(db);
  const now = new Date().toISOString(), staleBefore = new Date(Date.now() - RUN_STALE_AFTER_MS).toISOString();
  // A crashed consumer may have reached its provider. Surface uncertainty;
  // never reclaim it as a fresh send attempt.
  await db.prepare("UPDATE quality_notification_outbox SET status='unknown',updated_at=? WHERE status='processing' AND updated_at<?").bind(now, staleBefore).run();
  if (qualityNotificationProviderStatus(notificationEnv) !== "configured") return { processed: 0 };
  const rows = await db.prepare("SELECT id,payload_json AS payloadJson FROM quality_notification_outbox WHERE status='queued' ORDER BY created_at,id LIMIT 2")
    .all<{ id: string; payloadJson: string }>();
  let processed = 0;
  for (const row of rows.results) {
    const claimed = await db.prepare("UPDATE quality_notification_outbox SET status='processing',updated_at=? WHERE id=? AND status='queued'").bind(now, row.id).run();
    if (Number(claimed.meta?.changes ?? 0) !== 1) continue;
    const event = JSON.parse(row.payloadJson) as QualityIncidentEvent;
    const incident = await db.prepare("SELECT status,cycle FROM quality_incidents WHERE id=?").bind(event.incidentId).first<{ status: string; cycle: number }>();
    if (!incident || incident.cycle !== event.cycle || (event.eventKind === "opened" ? incident.status === "resolved" : incident.status !== "resolved")) {
      await db.prepare("UPDATE quality_notification_outbox SET status='superseded',updated_at=? WHERE id=? AND status='processing'").bind(now, row.id).run();
      continue;
    }
    await recordNotification(db, event, notificationEnv, fetcher, now);
    const eventKey = event.cycle > 1 ? `${event.eventKind}:${event.cycle}` : event.eventKind;
    const delivery = await db.prepare("SELECT status FROM quality_notification_deliveries WHERE incident_id=? AND channel='email' AND event_kind=?")
      .bind(event.incidentId, eventKey).first<{ status: string }>();
    const uncertain = !delivery || delivery.status === "pending" || delivery.status === "unknown";
    await db.prepare("UPDATE quality_notification_outbox SET status=?,updated_at=? WHERE id=? AND status='processing'")
      .bind(uncertain ? "unknown" : "processed", now, row.id).run();
    processed++;
  }
  return { processed };
}

export async function readQualityDashboard(db: D1Database, notificationEnv: QualityNotificationEnvironment = {}) {
  await ensureQualitySchema(db);
  const [runs, incidents, deliveries, checks, overrides, outbox] = await Promise.all([
    db.prepare(`SELECT id,operation_key AS operationKey,trigger_kind AS triggerKind,release_id AS releaseId,status,started_at AS startedAt,finished_at AS finishedAt,
      passed_count AS passedCount,failed_count AS failedCount,degraded_count AS degradedCount,blocked_count AS blockedCount,duration_ms AS durationMs,actor,
      total_checks AS totalChecks,current_check_id AS currentCheckId
      FROM quality_runs ORDER BY started_at DESC LIMIT 30`).all(),
    db.prepare(`SELECT id,check_id AS checkId,family,world,route,viewport,severity,status,first_seen_at AS firstSeenAt,last_seen_at AS lastSeenAt,
      recovered_at AS recoveredAt,acknowledged_at AS acknowledgedAt,acknowledged_by AS acknowledgedBy,resolved_at AS resolvedAt,
      occurrences,last_observed AS lastObserved FROM quality_incidents ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,last_seen_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT incident_id AS incidentId,channel,event_kind AS eventKind,status,provider_message_id AS providerMessageId,reason,created_at AS createdAt
      FROM quality_notification_deliveries ORDER BY created_at DESC LIMIT 50`).all(),
    db.prepare(`SELECT check_id AS checkId,family,world,route,viewport,severity,cadence_minutes AS cadenceMinutes,expected,release_blocking AS releaseBlocking,active,updated_at AS updatedAt
      FROM quality_checks ORDER BY severity,check_id`).all(),
    db.prepare(`SELECT check_id AS checkId,cadence_minutes AS cadenceMinutes FROM quality_schedule_overrides`).all(),
    db.prepare(`SELECT SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN status IN ('unknown','processing') THEN 1 ELSE 0 END) AS uncertain FROM quality_notification_outbox`).first<{ queued: number | null; uncertain: number | null }>(),
  ]);
  // The registry exists before the first run. Loading the dashboard must not
  // claim there are zero checks, or require a run with email side effects just
  // to discover them. Persisted settings still override registry defaults.
  const persistedChecks = new Map((checks.results || []).map((row) => [String(row.checkId), row]));
  const cadenceOverrides = new Map((overrides.results || []).map((row) => [String(row.checkId), row.cadenceMinutes]));
  const availableChecks = qualityRegistry.map((check) => ({ ...check, active: 1,
    ...persistedChecks.get(check.checkId),
    ...(cadenceOverrides.has(check.checkId) ? { cadenceMinutes: cadenceOverrides.get(check.checkId) } : {}) }));
  return { generatedAt: new Date().toISOString(), notificationProvider: { email: qualityNotificationProviderStatus(notificationEnv), queued: Number(outbox?.queued ?? 0), uncertain: Number(outbox?.uncertain ?? 0) }, checks: availableChecks, runs: runs.results, incidents: incidents.results, deliveries: deliveries.results };
}

export async function readQualityRunStatus(db: D1Database, input: { runId?: string; activeOnly?: boolean } = {}) {
  await ensureQualitySchema(db);
  const row = input.runId
    ? await db.prepare(`SELECT id,trigger_kind AS triggerKind,release_id AS releaseId,status,started_at AS startedAt,finished_at AS finishedAt,
        passed_count AS passedCount,failed_count AS failedCount,degraded_count AS degradedCount,blocked_count AS blockedCount,duration_ms AS durationMs,
        total_checks AS totalChecks,current_check_id AS currentCheckId FROM quality_runs WHERE id=?`).bind(input.runId).first()
    : input.activeOnly
      ? await db.prepare(`SELECT id,trigger_kind AS triggerKind,release_id AS releaseId,status,started_at AS startedAt,finished_at AS finishedAt,
          passed_count AS passedCount,failed_count AS failedCount,degraded_count AS degradedCount,blocked_count AS blockedCount,duration_ms AS durationMs,
          total_checks AS totalChecks,current_check_id AS currentCheckId FROM quality_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1`).first()
      : null;
  return { generatedAt: new Date().toISOString(), run: row || null };
}

export async function updateQualityIncident(db: D1Database, input: { incidentId: string; action: "acknowledge" | "resolve" | "reopen"; actor: string }) {
  await ensureQualitySchema(db);
  const now = new Date().toISOString();
  if (input.action === "acknowledge") await db.prepare(`UPDATE quality_incidents SET status='acknowledged',acknowledged_at=?,acknowledged_by=? WHERE id=? AND status='open'`).bind(now, input.actor, input.incidentId).run();
  if (input.action === "resolve") await db.prepare(`UPDATE quality_incidents SET status='resolved',resolved_at=?,resolved_by=? WHERE id=? AND status!='resolved'`).bind(now, input.actor, input.incidentId).run();
  if (input.action === "reopen") await db.prepare(`UPDATE quality_incidents SET status='open',cycle=cycle+1,resolved_at=NULL,resolved_by=NULL,recovered_at=NULL,last_seen_at=? WHERE id=?`).bind(now, input.incidentId).run();
  return db.prepare(`SELECT id,status,acknowledged_at AS acknowledgedAt,resolved_at AS resolvedAt FROM quality_incidents WHERE id=?`).bind(input.incidentId).first();
}

export async function updateQualitySchedule(db: D1Database, input: { checkId: string; cadenceMinutes: number; actor: string }) {
  await ensureQualitySchema(db);
  const allowed = new Set([5, 10, 30, 60, 180, 360, 720, 1440]);
  if (!qualityRegistry.some((check) => check.checkId === input.checkId) || !allowed.has(input.cadenceMinutes)) throw new Error("invalid_quality_schedule");
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO quality_schedule_overrides (check_id,cadence_minutes,updated_at,updated_by) VALUES (?,?,?,?)
    ON CONFLICT(check_id) DO UPDATE SET cadence_minutes=excluded.cadence_minutes,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
    .bind(input.checkId, input.cadenceMinutes, now, input.actor).run();
  await db.prepare(`UPDATE quality_checks SET cadence_minutes=?,updated_at=? WHERE check_id=?`).bind(input.cadenceMinutes, now, input.checkId).run();
  return { checkId: input.checkId, cadenceMinutes: input.cadenceMinutes, updatedAt: now };
}
