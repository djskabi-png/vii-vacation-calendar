import type { SupplierCatalogEntry, SupplierCatalogWorld } from "./supplier-catalog-store.ts";
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const childId = (v: unknown) => { const r = row(v); const id = Number(r.id ?? r.roomID ?? r.roomId ?? r.MainPageID); return Number.isSafeInteger(id) && id > 0 ? id : null; };
function children(v: unknown): Row[] { if (!Array.isArray(v)) throw new Error("missing_gallery_children"); const ids = v.map(childId); if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) throw new Error("invalid_gallery_child_ids"); return v.map(row); }
function sameChildren(before: Row[], after: Row[]) { const ids = new Set(after.map(childId)); return before.length === after.length && before.every(item => ids.has(childId(item))); }
function media(current: Row, normalized: Row): Row { const next = { ...current }; for (const key of ["image", "images", "gallery"]) if (Object.prototype.hasOwnProperty.call(normalized, key)) { if (!Object.prototype.hasOwnProperty.call(current, key)) throw new Error("missing_gallery_media_field"); next[key] = copy(normalized[key]); } if (Object.prototype.hasOwnProperty.call(normalized, "galleryGroups")) next.galleryGroups = copy(normalized.galleryGroups); return next; }
export function patchGalleryMedia(world: SupplierCatalogWorld, current: SupplierCatalogEntry, normalized: SupplierCatalogEntry): SupplierCatalogEntry {
  if (current.supplierId !== normalized.supplierId) throw new Error("foreign_gallery_supplier");
  const cs = row(current.summary), ns = row(normalized.summary); const next: SupplierCatalogEntry = { ...current, summary: media(cs, ns), ...(current.detail === undefined ? {} : { detail: copy(current.detail) }) };
  if (world === "vacations" || world === "events") {
    if (!current.detail || !normalized.detail) throw new Error("missing_gallery_detail");
    const cd = row(current.detail), nd = row(normalized.detail), oldRooms = children(cd.rooms), newRooms = children(nd.rooms);
    if (!sameChildren(oldRooms, newRooms)) throw new Error("gallery_child_set_mismatch");
    const byId = new Map(newRooms.map((r) => [childId(r), r])); next.detail = { ...media(cd, nd), rooms: oldRooms.map((r) => media(r, byId.get(childId(r))!)) };
  } else if (world === "rooms") {
    const oldRooms = children(cs.rooms), newRooms = children(ns.rooms);
    if (!sameChildren(oldRooms, newRooms)) throw new Error("gallery_child_set_mismatch");
    const byId = new Map(newRooms.map((r) => [childId(r), r])); next.summary = { ...media(cs, ns), rooms: oldRooms.map((r) => media(r, byId.get(childId(r))!)) };
  } else {
    const oldPackages = children(cs.packages), newPackages = children(ns.packages);
    if (!sameChildren(oldPackages, newPackages)) throw new Error("gallery_child_set_mismatch");
    const byId = new Map(newPackages.map((r) => [childId(r), r])); next.summary = { ...media(cs, ns), packages: oldPackages.map((r) => media(r, byId.get(childId(r))!)) };
  }
  return next;
}
