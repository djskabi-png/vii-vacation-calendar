import type { D1Database } from "../../types/cloudflare-runtime";
import { cachedDiscovery } from "./discovery-offer-cache.ts";

export type AmenityCacheValue = { groups: Array<{ title: string; items: string[] }>; source: "biz-shared-amenities" | "migrated-vii-place-amenities" };
type Fetcher = typeof fetch;
const policy = { freshMs: 7 * 86_400_000, staleMs: 30 * 86_400_000 };
const fetchIds = new WeakMap<Fetcher, number>(); let nextFetchId = 1;
function fetchScope(fetcher: Fetcher) { if (fetcher === fetch) return "runtime"; let id = fetchIds.get(fetcher); if (!id) { id = nextFetchId++; fetchIds.set(fetcher, id); } return `fixture-${id}`; }
async function credentialScope(token: string) { const bytes = new TextEncoder().encode(token); const digest = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join(""); }

function publicGroups(groups: AmenityCacheValue["groups"]): AmenityCacheValue["groups"] {
  if (groups.length > 64) throw new Error("amenity_groups_too_large");
  if (groups.some(group => typeof group.title !== "string" || group.title.length > 160 || !Array.isArray(group.items) || group.items.length > 128 || group.items.some(item => typeof item !== "string" || item.length > 160))) throw new Error("amenity_groups_too_large");
  return groups.map(group => ({ title: group.title, items: [...group.items] }));
}

function validGroups(value: unknown) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const source = value as AmenityCacheValue;
    if (!["biz-shared-amenities", "migrated-vii-place-amenities"].includes(source.source) || !Array.isArray(source.groups)) return false;
    publicGroups(source.groups);
    return true;
  } catch { return false; }
}

export async function cachedBusinessAmenities(options: {
  supplierId: number; token: string; sourceRevision?: string; db?: D1Database | null; fetchImpl?: Fetcher; now?: () => number; load: () => Promise<AmenityCacheValue>;
}) {
  const credential = await credentialScope(options.token);
  return cachedDiscovery<AmenityCacheValue>({
    key: ["business-amenities", 6, fetchScope(options.fetchImpl ?? fetch), credential, options.sourceRevision || "unknown", "bizonline", "vacations", "he", options.supplierId],
    db: options.db,
    policy, now: options.now,
    load: async () => {
      const value = await options.load();
      return { ...value, groups: publicGroups(value.groups) };
    },
    validate: validGroups,
  });
}

export async function cachedAmenityTaxonomy(options: { token: string; db?: D1Database | null; fetchImpl?: Fetcher; now?: () => number; sourceRevision?: string }) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credential = await credentialScope(options.token);
  return cachedDiscovery<unknown>({
    key: ["business-amenity-taxonomy", 5, fetchScope(fetchImpl), credential, options.sourceRevision || "unknown", "bizonline", "vacations", "he"], db: options.db, policy, now: options.now,
    load: async () => {
      const response = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations/types", { headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error("supplier_amenities_unavailable");
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_amenity_taxonomy");
      const source = value as Record<string, unknown>;
      if (!Array.isArray(source.amenities) || !Array.isArray(source.amenity_categories)) throw new Error("invalid_amenity_taxonomy");
      if (source.amenities.length > 20_000 || source.amenity_categories.length > 2_000 || source.roomTypes !== undefined && (!Array.isArray(source.roomTypes) || source.roomTypes.length > 2_000)) throw new Error("amenity_taxonomy_too_large");
      const pick = (value: unknown, fields: string[], identity: string, label: string) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_amenity_taxonomy");
        const row = value as Record<string, unknown>;
        const identityValue = typeof row[identity] === "string" && /^\d+$/.test(row[identity] as string) ? Number(row[identity]) : row[identity];
        if (!Number.isSafeInteger(identityValue) || Number(identityValue) <= 0 || typeof row[label] !== "string" || !row[label]) throw new Error("invalid_amenity_taxonomy");
        for (const field of fields) if (row[field] !== undefined && row[field] !== null
          && (typeof row[field] !== "string" && typeof row[field] !== "number" && typeof row[field] !== "boolean"
          || typeof row[field] === "string" && row[field].length > 4096)) throw new Error("invalid_amenity_taxonomy");
        return Object.fromEntries(fields.filter(field => row[field] !== undefined).map(field => [field, field === identity ? identityValue : row[field]]));
      };
      return { amenities: source.amenities.map(value => pick(value, ["id", "parentID", "title", "filterTitle", "categoryID", "orderInCategory"], "id", "title")), amenity_categories: source.amenity_categories.map(value => pick(value, ["categoryID", "categoryName", "order"], "categoryID", "categoryName")), roomTypes: Array.isArray(source.roomTypes) ? source.roomTypes.map(value => pick(value, ["id", "title"], "id", "title")) : [] };
    },
    validate: value => !!value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Record<string, unknown>).amenities) && Array.isArray((value as Record<string, unknown>).amenity_categories),
  });
}

export async function cachedSharedAmenityList(options: { token: string; db?: D1Database | null; fetchImpl?: Fetcher; now?: () => number; sourceRevision?: string }) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const credential = await credentialScope(options.token);
  return cachedDiscovery<Record<string, unknown>>({
    key: ["business-shared-amenity-list", 2, fetchScope(fetchImpl), credential, options.sourceRevision || "unknown", "bizonline", "vacations"], db: options.db, policy, now: options.now,
    load: async () => {
      const response = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations", { headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error("supplier_amenities_unavailable");
      const raw = await response.json();
      const places = raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).places) ? (raw as Record<string, unknown>).places as unknown[] : null;
      if (!places) throw new Error("invalid_amenity_list");
      const normalized: Record<string, unknown> = {};
      if (places.length > 20_000) throw new Error("amenity_list_too_large");
      for (const item of places) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>; const id = Number(row.siteID ?? row.id);
        if (Number.isSafeInteger(id) && id > 0 && Array.isArray(row.shared_amenities)) { if (row.shared_amenities.length > 512) throw new Error("amenity_list_too_large"); normalized[String(id)] = row.shared_amenities.map(value => typeof value === "number" || typeof value === "string" ? value : pickAmenity(value)).filter(Boolean); }
      }
      return normalized;
    },
    validate: value => !!value && typeof value === "object" && !Array.isArray(value),
  });
}

function pickAmenity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = row.id ?? row.amenityID ?? row.amenityId;
  return Object.fromEntries([["id", id], ["description", row.description], ["shown", row.shown]].filter(([, field]) => field !== undefined));
}
