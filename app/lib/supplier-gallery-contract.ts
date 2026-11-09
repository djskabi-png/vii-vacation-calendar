import { isQuarantinedGalleryMedia } from "./legacy-gallery-media.ts";
/** Provider-owned gallery identity and wire-order contract. */
export type GalleryGroup = { key?: string; title?: string; imageIds: string[] };
export type GalleryEntity = { entityKey: string; galleryKey: "media"; imageIds: string[]; groups?: GalleryGroup[] };
export type GalleryContract = {
  world: "vacations" | "events" | "rooms" | "spa";
  supplierId: string;
  fetchedAt?: string;
  apiCreatedAt?: string;
  fingerprint?: string;
  previewImageIds?: string[];
  excludedImageIds?: string[];
  entities: GalleryEntity[];
  source: "api" | "accepted";
};

const orderedEntries = Symbol("orderedEntries");
type OrderedObject = Record<string, unknown> & { [orderedEntries]?: Array<[string, unknown]> };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : Object.create(null);
const string = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const canonicalImage = (value: unknown) => {
  const raw = string(value);
  if (!raw) return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : null;
  if (isQuarantinedGalleryMedia(raw)) return null;
  return raw.split(/[?#]/)[0].replace(/\\/g, "/").match(/(?:\/gallery\/|\/media\/)([^/]+)$/i)?.[1] || raw;
};
const first = (value: unknown, keys: string[]) => { const row = object(value); for (const key of keys) { const found = canonicalImage(row[key]); if (found) return found; } return null; };
const ordered = (value: unknown) => (object(value) as OrderedObject)[orderedEntries] || Object.entries(object(value));
const images = (value: unknown) => Array.isArray(value) ? value.map((item) => typeof item === "string" ? canonicalImage(item) : first(item, ["id", "imageID", "imageId", "url", "src", "path"])).filter((item): item is string => Boolean(item)) : [];

export function parseOrderedJson(source: string, maxBytes = 8_000_000, maxDepth = 32): unknown {
  if (new TextEncoder().encode(source).byteLength > maxBytes) throw new Error("gallery_json_too_large");
  try { JSON.parse(source); } catch { throw new Error("gallery_invalid_json"); }
  let cursor = 0; let nodes = 0;
  const whitespace = () => { while (/\s/.test(source[cursor] || "")) cursor++; };
  const read = (depth: number): unknown => {
    if (++nodes > 200_000) throw new Error("gallery_json_too_large");
    if (depth > maxDepth) throw new Error("gallery_json_too_deep");
    whitespace(); const marker = source[cursor];
    if (marker === '"') { const start = cursor; cursor++; while (cursor < source.length) { const char = source[cursor++]; if (char === '"') return JSON.parse(source.slice(start, cursor)); if (char === "\\") cursor++; if (char && char < " ") throw new Error("gallery_invalid_json"); } throw new Error("gallery_invalid_json"); }
    if (marker === "[") { cursor++; const result: unknown[] = []; whitespace(); if (source[cursor] === "]") { cursor++; return result; } while (cursor < source.length) { result.push(read(depth + 1)); whitespace(); const separator = source[cursor++]; if (separator === "]") return result; if (separator !== ",") throw new Error("gallery_invalid_json"); } }
    if (marker === "{") { cursor++; const result: OrderedObject = Object.create(null); const entries: Array<[string, unknown]> = []; const seen = new Set<string>(); whitespace(); if (source[cursor] === "}") { cursor++; result[orderedEntries] = entries; return result; } while (cursor < source.length) { const key = read(depth + 1); if (typeof key !== "string" || seen.has(key)) throw new Error("gallery_duplicate_key"); seen.add(key); whitespace(); if (source[cursor++] !== ":") throw new Error("gallery_invalid_json"); const child = read(depth + 1); Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true }); entries.push([key, child]); whitespace(); const separator = source[cursor++]; if (separator === "}") { result[orderedEntries] = entries; return result; } if (separator !== ",") throw new Error("gallery_invalid_json"); } }
    const literal = source.slice(cursor).match(/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/); if (!literal) throw new Error("gallery_invalid_json"); cursor += literal[1].length; return literal[1] === "true" ? true : literal[1] === "false" ? false : literal[1] === "null" ? null : Number(literal[1]);
  };
  const result = read(0); whitespace(); if (cursor !== source.length) throw new Error("gallery_invalid_json"); return result;
}
export function orderedObjectEntries(value: unknown): Array<[string, unknown]> { return ordered(value); }

function galleryRows(value: unknown) {
  const values = Array.isArray(value) ? value.map((item, index) => [`position:${index}`, item] as [string, unknown]) : ordered(value);
  return values.map(([key, item]) => { const row = object(item); return { key: first(row, ["id", "galleryID", "galleryId"]) || key, images: images(row.pictures ?? row.images ?? row.photos) }; }).filter((row) => row.images.length);
}
function unique(values: string[]) { return [...new Set(values)]; }

export async function buildApiGalleryContract(world: GalleryContract["world"], supplierId: string | number, rawValue: unknown, wireText?: string): Promise<GalleryContract> {
  const raw = object(rawValue); const entities: GalleryEntity[] = []; const placeId = `${world}:${supplierId}:place`;
  const excluded = new Set<string>();
  const inspect = (value: unknown): void => {
    if (typeof value === "string") { if (isQuarantinedGalleryMedia(value)) excluded.add(value.split(/[?#]/)[0].split("/").at(-1)!); }
    else if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      if ((key === "galleries" || key === "packages") && child && typeof child === "object" && !Array.isArray(child)) Object.values(child).forEach(inspect);
      else if (["galleries", "gallery", "galleryGroups", "pictures", "images", "image", "rooms", "packages", "pack_picture", "spa_picture"].includes(key)) inspect(child);
    }
  };
  inspect(raw);
  const placeGroups = Array.isArray(raw.galleryGroups) ? raw.galleryGroups.map((group, index) => ({ key: first(group, ["id", "galleryID", "galleryId"]) || `position:${index}`, images: images(object(group).images) })).filter((group) => group.images.length) : [];
  const rawPlaceGroups = placeGroups.length ? placeGroups : (Array.isArray(raw.gallery) && raw.gallery.every((item) => typeof item === "string")
    ? [{ key: "gallery", images: images(raw.gallery) }]
    : galleryRows(raw.galleries ?? raw.gallery).map((row) => row));
  const rawGalleryImages = rawPlaceGroups.flatMap((row) => row.images).concat(Array.isArray(raw.images) ? images(raw.images) : []);
  if (rawGalleryImages.length) entities.push({ entityKey: placeId, galleryKey: "media", imageIds: unique(rawGalleryImages), groups: rawPlaceGroups.map((group) => ({ key: group.key, imageIds: unique(group.images) })) });
  const seenRoomIds = new Set<string>();
  for (const roomValue of Array.isArray(raw.rooms) ? raw.rooms : []) {
    const room = object(roomValue); const roomId = first(room, ["roomID", "roomId", "id"]); if (!roomId) throw new Error("invalid_gallery_owner_id");
    if (seenRoomIds.has(roomId)) throw new Error("duplicate_gallery_owner_id");
    seenRoomIds.add(roomId);
    const entity = `${world}:${supplierId}:room:${roomId}`;
    const roomGroups = Array.isArray(room.galleryGroups)
      ? room.galleryGroups.map((group, index) => ({ key: first(group, ["id", "galleryID", "galleryId"]) || `position:${index}`, images: images(object(group).images) })).filter((group) => group.images.length)
      : galleryRows(room.galleries);
    const roomImages = roomGroups.flatMap((group) => group.images).concat(Array.isArray(room.images) ? images(room.images) : []);
    entities.push({ entityKey: entity, galleryKey: "media", imageIds: unique(roomImages), groups: roomGroups.map((group) => ({ key: group.key, imageIds: unique(group.images) })) });
  }
  if (world === "spa") {
    const packages = Array.isArray(raw.packages) ? raw.packages : ordered(raw.packages).map(([, value]) => value);
    const seenPackageIds = new Set<string>();
    packages.forEach((value) => { const row = object(value); const image = first(row, ["pack_picture", "CONCAT('https://www.spaplus.co.il/gallery/',picture)", "image", "imageUrl", "imageURL"]); const id = first(row, ["MainPageID", "id"]); if (!id) throw new Error("invalid_gallery_owner_id"); if (seenPackageIds.has(id)) throw new Error("duplicate_gallery_owner_id"); seenPackageIds.add(id); entities.push({ entityKey: `${world}:${supplierId}:package:${id}`, galleryKey: "media", imageIds: image ? [image] : [] }); });
  }
  const fingerprint = wireText ? `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wireText))), (byte) => byte.toString(16).padStart(2, "0")).join("")}` : undefined;
  const previewImageIds = world === "spa" ? [first(raw, ["spa_picture", "CONCAT('https://www.spaplus.co.il/gallery/',picture)", "image"])].filter((value): value is string => !!value)
    : Object.hasOwn(raw, "representative_galleries") ? unique([...galleryRows(raw.representative_galleries).flatMap(group => group.images), ...rawGalleryImages]) : undefined;
  return { world, supplierId: String(supplierId), fetchedAt: string(raw.fetchedAt) || undefined, apiCreatedAt: string(raw.created ?? raw.createdAt) || undefined, fingerprint, entities, source: "api", ...(previewImageIds ? { previewImageIds } : {}), ...(excluded.size ? { excludedImageIds: [...excluded] } : {}) };
}

export async function buildAcceptedGalleryContract(world: GalleryContract["world"], entry: unknown): Promise<GalleryContract> {
  const row = object(entry); const summary = object(row.summary); const detail = object(row.detail); const source = Object.keys(detail).length ? detail : summary;
  if (row.supplierId !== undefined && summary.supplierId !== undefined && String(row.supplierId) !== String(summary.supplierId)) throw new Error("foreign_gallery_supplier");
  if (world === "spa" && row.supplierId !== undefined && summary.id !== undefined && String(row.supplierId) !== String(summary.id)) throw new Error("foreign_gallery_supplier");
  const contract = await buildApiGalleryContract(world, first(row, ["supplierId", "siteID", "id"]) || first(source, ["supplierId", "siteID", "id"]) || "unknown", source);
  const previewImageIds = world === "spa" ? [canonicalImage(summary.image)].filter((value): value is string => !!value) : images(summary.images);
  return { ...contract, ...(previewImageIds.length ? { previewImageIds } : {}), source: "accepted", fetchedAt: string(row.fetchedAt) || undefined };
}

/** Reject owner/order corruption before a complete API candidate receives a proof.
 * Source owners without photos stay explicit audit findings, never borrowed media. */
export async function assertGallerySourceProjection(world: GalleryContract["world"], supplierId: number, raw: unknown, entry: unknown, listPlace?: unknown) {
  const source = listPlace ? { ...object(raw), representative_galleries: object(listPlace).galleries } : raw;
  const expected = await buildApiGalleryContract(world, supplierId, source);
  const actual = await buildAcceptedGalleryContract(world, entry);
  // Reviewed source-file failures remain visible in the audit. They must not
  // prevent healthy owners from refreshing when their surviving order agrees.
  const issues = compareGalleryContracts(expected, actual).issues.filter(issue =>
    !issue.startsWith("unverified_empty_owner_media:") && !issue.startsWith("unverified_quarantined_api_media:"));
  if (issues.length) throw new Error("supplier_gallery_projection_mismatch");
}

export function compareGalleryContracts(expected: GalleryContract, actual: GalleryContract) {
  const issues: string[] = []; if (!expected.entities.length || !actual.entities.length) issues.push("unknown_or_empty"); if (expected.world !== actual.world || expected.supplierId !== actual.supplierId) issues.push("foreign_entity"); if (expected.entities.length !== actual.entities.length) issues.push("entity_membership");
  for (const filename of expected.excludedImageIds || []) issues.push(`unverified_quarantined_api_media:${filename}`);
  for (const value of [...expected.entities, ...actual.entities]) if (!value.imageIds.length) issues.push(`unverified_empty_owner_media:${value.entityKey}`);
  if (expected.previewImageIds && JSON.stringify(expected.previewImageIds) !== JSON.stringify(actual.previewImageIds)) issues.push("preview_image_order");
  for (let index = 0; index < Math.max(expected.entities.length, actual.entities.length); index++) { const left = expected.entities[index], right = actual.entities[index]; if (!left || !right || left.entityKey !== right.entityKey || left.galleryKey !== right.galleryKey) { issues.push(`entity_order:${index}`); continue; } if (left.imageIds.length !== right.imageIds.length || left.imageIds.some((id, imageIndex) => id !== right.imageIds[imageIndex])) issues.push(`image_order:${left.entityKey}`); const lg = left.groups || [], rg = right.groups || []; if (lg.length !== rg.length) issues.push(`group_membership:${left.entityKey}`); for (let g = 0; g < Math.max(lg.length, rg.length); g++) { const a = lg[g], b = rg[g]; if (!a || !b) continue; if (!a.key || !b.key) issues.push(`unverified_group_identity:${left.entityKey}:${g}`); else if (a.key !== b.key) issues.push(`group_order:${left.entityKey}:${g}`); if (a.imageIds.length !== b.imageIds.length || a.imageIds.some((id, i) => id !== b.imageIds[i])) issues.push(`group_image_order:${left.entityKey}:${g}`); } }
  return { equal: issues.length === 0, issues };
}
