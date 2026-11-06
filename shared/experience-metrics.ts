export const EXPERIENCE_DEFINITION_VERSION = "experience-v1" as const;
/** Private Service Binding identity, never taken from a browser payload. */
export const EXPERIENCE_SOURCE_HEADER = "X-VII-Experience-Source" as const;
export const EXPERIENCE_INGESTION_VERSION = "experience-source-v2" as const;
export const EXPERIENCE_INGESTION_PATH = "/__vii/experience/v2" as const;
export const EXPERIENCE_PROTOCOL_HEADER = "X-VII-Experience-Protocol" as const;
const worlds = ["vacation","events","spa","hourly","activities","trails","providers","global"] as const;
const routes = ["home","world","results","place","editorial"] as const;
const devices = ["mobile","desktop"] as const;
const locales = ["he","en","fr","ru"] as const;
const networks = ["slow-2g","2g","3g","4g","unknown"] as const;
const caches = ["hit","miss","unknown"] as const;
const metrics = ["lcp","inp","cls","ttfb","navigation_commit","results_ready","map_ready","gallery_ready","client_error"] as const;
const statuses = ["measured","error","timeout","unsupported","cancelled"] as const;
export type ExperienceMetric = typeof metrics[number];
export type ExperienceStatus = typeof statuses[number];
export type ExperienceContext = { world: typeof worlds[number]; routeKind: typeof routes[number]; device: typeof devices[number]; locale: typeof locales[number]; network: typeof networks[number]; cache: typeof caches[number] };
export type ExperienceSample = { metric: ExperienceMetric; status: ExperienceStatus; value: number | null; observationId: string; revision: number };
export type ExperienceBatch = { schemaVersion: 1; definitionVersion: typeof EXPERIENCE_DEFINITION_VERSION; batchId: string; buildId: string; consent: "granted"; sentAt: number; sampleRateBps: number; context: ExperienceContext; samples: ExperienceSample[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const namespaceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const exact = (x: unknown, keys: string[]) => !!x && typeof x === "object" && !Array.isArray(x) && Object.keys(x as object).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(x, k));
const inSet = (v: unknown, a: readonly string[]) => typeof v === "string" && a.includes(v);
export function parseExperienceBatch(input: unknown, nowMs = Date.now()): ExperienceBatch | null {
  if (!exact(input, ["schemaVersion","definitionVersion","batchId","buildId","consent","sentAt","sampleRateBps","context","samples"])) return null;
  const x = input as Record<string, unknown>;
  if (x.schemaVersion !== 1 || x.definitionVersion !== EXPERIENCE_DEFINITION_VERSION || x.consent !== "granted" || typeof x.batchId !== "string" || !uuid.test(x.batchId) || typeof x.buildId !== "string" || !namespaceUuid.test(x.buildId) || !Number.isInteger(x.sentAt) || (x.sentAt as number) % 60000 !== 0 || (x.sentAt as number) < nowMs - 300000 || (x.sentAt as number) > nowMs + 60000 || !Number.isInteger(x.sampleRateBps) || (x.sampleRateBps as number) < 1 || (x.sampleRateBps as number) > 1000 || !Array.isArray(x.samples) || x.samples.length < 1 || x.samples.length > 16 || !exact(x.context, ["world","routeKind","device","locale","network","cache"])) return null;
  const c = x.context as Record<string, unknown>; if (!inSet(c.world, worlds) || !inSet(c.routeKind, routes) || !inSet(c.device, devices) || !inSet(c.locale, locales) || !inSet(c.network, networks) || !inSet(c.cache, caches)) return null;
  const seen = new Set<string>(); const seenObservations = new Set<string>(); const out: ExperienceSample[] = [];
  for (const raw of x.samples) { if (!exact(raw, ["metric","status","value","observationId","revision"])) return null; const s = raw as Record<string, unknown>; if (!inSet(s.metric, metrics) || !inSet(s.status, statuses) || seen.has(s.metric as string) || typeof s.observationId !== "string" || !uuid.test(s.observationId) || seenObservations.has(s.observationId) || !Number.isInteger(s.revision) || (s.revision as number) < 1 || (s.revision as number) > 1000) return null; seen.add(s.metric as string); seenObservations.add(s.observationId); const status = s.status as ExperienceStatus; const value = s.value;
    if (status === "unsupported" || status === "cancelled") { if (value !== null) return null; }
    if (s.metric === "client_error" && (status !== "error" || value !== 1)) return null;
    if (status === "measured" && (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > (s.metric === "cls" ? 10000 : 120000))) return null;
    if ((status === "error" || status === "timeout") && s.metric !== "client_error" && value !== null && (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > (s.metric === "cls" ? 10000 : 120000))) return null;
    if (s.metric === "cls" && status === "measured" && !Number.isInteger(value)) return null;
    out.push({ metric: s.metric as ExperienceMetric, status, value: value as number | null, observationId: s.observationId as string, revision: s.revision as number }); }
  return { schemaVersion: 1, definitionVersion: EXPERIENCE_DEFINITION_VERSION, batchId: x.batchId as string, buildId: x.buildId as string, consent: "granted", sentAt: x.sentAt as number, sampleRateBps: x.sampleRateBps as number, context: { world: c.world, routeKind: c.routeKind, device: c.device, locale: c.locale, network: c.network, cache: c.cache } as ExperienceContext, samples: out };
}
export const LATENCY_BINS = [100,250,500,1000,1500,2500,4000,8000,15000,30000,60000,120000] as const;
export const CLS_BINS = [0,50,100,250,500,1000,2500,10000] as const;
export function histogramUpperBound(metric: ExperienceMetric, status: ExperienceStatus, value: number | null): number { if ((status !== "measured" && status !== "error" && status !== "timeout") || metric === "client_error" || value === null) return -1; const bins = metric === "cls" ? CLS_BINS : LATENCY_BINS; return bins.find(b => value <= b) ?? bins[bins.length - 1]; }
