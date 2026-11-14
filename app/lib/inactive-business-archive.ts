import { cache } from "react";
import generated from "../data/inactive-business-archive.generated.json" with { type: "json" };
import { publicCatalogDatabase } from "./runtime-database.ts";
import { readSupplierCatalogArchiveEntry, readSupplierCatalogEntry, supplierCanonicalPath, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export type InactiveBusiness = {
  id: string;
  world: SupplierCatalogWorld;
  supplierId: number;
  canonicalPath: string;
  legacyPaths: string[];
  name: string;
  description: string;
  location: string;
  area: string;
  image: string;
  images: string[];
  updatedAt?: string;
};

type GeneratedRecord = Omit<InactiveBusiness, "legacyPaths"> & { legacyPath?: string; legacyPaths?: string[] };
const staticRecords = (generated.records as GeneratedRecord[]).map((record): InactiveBusiness => ({
  ...record,
  legacyPaths: record.legacyPaths || (record.legacyPath ? [record.legacyPath] : []),
}));
const staticByIdentity = new Map(staticRecords.map((record) => [`${record.world}:${record.supplierId}`, record]));

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim())?.toString().trim() || "";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/** Public projection by explicit allow-list. Contact, prices, offers and availability never cross this boundary. */
function projectRuntimeArchive(world: SupplierCatalogWorld, supplierId: number, summaryValue: unknown, detailValue: unknown,
  canonicalPath: string, legacyPath: string | null, updatedAt: string): InactiveBusiness | null {
  const summary = record(summaryValue);
  const detail = record(detailValue);
  const name = text(summary.name, summary.title, detail.name, detail.title);
  if (!name) return null;
  const images = [...new Set([
    ...strings(summary.images),
    ...strings(detail.images),
    text(summary.image, detail.image),
  ].filter(Boolean))].slice(0, 24);
  return {
    id: `${world}:${supplierId}`,
    world,
    supplierId,
    canonicalPath: canonicalPath || supplierCanonicalPath(world, supplierId),
    legacyPaths: legacyPath ? [legacyPath] : [],
    name,
    description: text(summary.description, summary.shortDescription, detail.description, detail.summary,
      `עמוד המידע של ${name}. המקום אינו בפרסום פעיל כעת.`),
    location: text(summary.location, detail.location),
    area: text(summary.area, detail.area),
    image: images[0] || "",
    images,
    updatedAt,
  };
}

export const inactiveBusiness = cache(async (world: SupplierCatalogWorld, supplierId: number): Promise<InactiveBusiness | null> => {
  if (!Number.isSafeInteger(supplierId) || supplierId < 1) return null;
  try {
    const { database } = await publicCatalogDatabase();
    // The accepted active generation is authoritative. This check prevents a
    // historical static archive record from shadowing a supplier that was
    // reactivated after the current application bundle was built.
    if (await readSupplierCatalogEntry(database, world, supplierId)) return null;
    const archived = await readSupplierCatalogArchiveEntry(database, world, supplierId);
    if (archived?.status === "inactive") {
      return projectRuntimeArchive(world, supplierId, archived.summary, archived.detail, archived.canonicalPath,
        archived.legacyPath, archived.updatedAt) || staticByIdentity.get(`${world}:${supplierId}`) || null;
    }
    if (archived?.status === "active") return null;
  } catch {
    console.warn(`inactive_business_archive_fallback:${world}`);
  }
  return staticByIdentity.get(`${world}:${supplierId}`) || null;
});

export function generatedInactiveBusinesses() {
  return staticRecords;
}

export function generatedInactiveRedirects() {
  return Object.fromEntries(staticRecords.flatMap((record) => record.legacyPaths.map((path) => [path, record.canonicalPath])));
}
