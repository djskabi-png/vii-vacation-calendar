import inventory from "../data/legacy-redirect-inventory.json" with { type: "json" };
import { normalizeRedirectSource, type RedirectRecord } from "./admin-redirects.ts";

export type RedirectOrigin = "legacy" | "managed";
export type AdminRedirectRow = RedirectRecord & { origin: RedirectOrigin; bundled: boolean };
export type RedirectInventoryFilters = {
  query?: string;
  status?: "all" | "301" | "410";
  state?: "all" | "active" | "draft";
  origin?: "all" | RedirectOrigin;
  page?: number;
  pageSize?: number;
};

const bundledRedirects = inventory.redirects as Record<string, string>;
const bundledGone = inventory.gone as string[];
const normalizedBundledRedirects = new Map(Object.entries(bundledRedirects).map(([source, target]) => [normalizeRedirectSource(source), target]));
const normalizedBundledGone = new Set(bundledGone.map(normalizeRedirectSource));
const bundledSources = new Set([...normalizedBundledRedirects.keys(), ...normalizedBundledGone]);

export function bundledRedirectRecord(sourcePath: string): RedirectRecord | null {
  const source = normalizeRedirectSource(sourcePath);
  const target = normalizedBundledRedirects.get(source);
  if (target) return { source_path: source, target_path: target, status: 301, active: 1, deleted: 0,
    updated_at: inventory.generatedAt, updated_by: "legacy-inventory" };
  if (bundledSources.has(source)) return { source_path: source, target_path: null, status: 410, active: 1, deleted: 0,
    updated_at: inventory.generatedAt, updated_by: "legacy-inventory" };
  return null;
}

export function mergedRedirectInventory(managedRows: RedirectRecord[], filters: RedirectInventoryFilters = {}) {
  const rows = new Map<string, AdminRedirectRow>();
  for (const [source, target] of normalizedBundledRedirects) {
    rows.set(source, { source_path: source, target_path: target, status: 301, active: 1, deleted: 0,
      updated_at: inventory.generatedAt, updated_by: "legacy-inventory", origin: "legacy", bundled: true });
  }
  for (const source of normalizedBundledGone) {
    rows.set(source, { source_path: source, target_path: null, status: 410, active: 1, deleted: 0,
      updated_at: inventory.generatedAt, updated_by: "legacy-inventory", origin: "legacy", bundled: true });
  }
  let deleted = 0;
  for (const managed of managedRows) {
    const source = normalizeRedirectSource(managed.source_path);
    if (managed.deleted) { rows.delete(source); deleted += 1; continue; }
    rows.set(source, { ...managed, source_path: source, deleted: 0, origin: "managed", bundled: bundledSources.has(source) });
  }
  const all = [...rows.values()].sort((a, b) => a.source_path.localeCompare(b.source_path, "en"));
  const query = (filters.query || "").trim().toLowerCase();
  const status = filters.status || "all";
  const state = filters.state || "all";
  const origin = filters.origin || "all";
  const filtered = all.filter((row) => (!query || `${row.source_path} ${row.target_path || "410 gone"}`.toLowerCase().includes(query))
    && (status === "all" || row.status === Number(status))
    && (state === "all" || (state === "active") === Boolean(row.active))
    && (origin === "all" || row.origin === origin));
  const pageSize = Math.max(20, Math.min(200, Math.floor(filters.pageSize || 100)));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.floor(filters.page || 1)));
  const start = (page - 1) * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    pages,
    total: filtered.length,
    allTotal: all.length,
    baselineTotal: inventory.stats.total,
    deleted,
    counts: {
      redirects: all.filter((row) => row.status === 301).length,
      gone: all.filter((row) => row.status === 410).length,
      active: all.filter((row) => row.active).length,
      draft: all.filter((row) => !row.active).length,
      legacy: all.filter((row) => row.origin === "legacy").length,
      managed: all.filter((row) => row.origin === "managed").length,
    },
  };
}
