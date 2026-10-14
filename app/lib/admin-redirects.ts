import type { D1Database } from "../../types/cloudflare-runtime";

export type RedirectRecord = { source_path: string; target_path: string | null; status: 301 | 410; active: number; updated_at: string; updated_by: string };

const protectedPrefixes = ["/api", "/admin", "/_next", "/_vinext", "/assets", "/favicon", "/robots", "/sitemap"];
const currentRoutes = ["/", "/search", "/events", "/spas", "/hourly", "/business", "/booking", "/discover", "/providers", "/platform", "/guides", "/legal", "/accessibility", "/join", "/contact", "/favorites", "/account", "/activities", "/attractions", "/corporate", "/destinations", "/gift-card", "/questions", "/trails", "/handoff", "/villas", "/suite-complexes", "/luxury-suites", "/vacation-apartments", "/vacations"];

function prefixMatch(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isProtectedRedirectPath(path: string) {
  return protectedPrefixes.some((prefix) => prefixMatch(path, prefix));
}

export function shouldCheckRedirect(path: string) {
  if (!path.startsWith("/") || (/\.[^/]+$/.test(path) && !/\.(html?|php)$/i.test(path))) return false;
  return !currentRoutes.some((prefix) => prefixMatch(path, prefix)) && !isProtectedRedirectPath(path);
}

export function parseRedirectInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const source = row.sourcePath;
  const target = row.targetPath;
  const status = row.status;
  const active = row.active;
  if (typeof source !== "string" || source.length > 240 || !/^\/[a-zA-Z0-9/_~%.-]+$/.test(source) || source.includes("//") || source.includes("..") || !shouldCheckRedirect(source)) return null;
  if (status !== 301 && status !== 410 || typeof active !== "boolean") return null;
  if (status === 410) return { sourcePath: source, targetPath: null, status: 410 as const, active };
  if (typeof target !== "string" || target.length > 400 || !/^\/[a-zA-Z0-9/_~%?=&+.-]+$/.test(target) || target.startsWith("//") || target.includes("..")) return null;
  const targetPath = target.split("?")[0].replace(/\/$/, "") || "/";
  if (targetPath === source || isProtectedRedirectPath(targetPath) || shouldCheckRedirect(targetPath)) return null;
  return { sourcePath: source, targetPath: target, status: 301 as const, active };
}

export async function redirectLookupDatabase(): Promise<D1Database> {
  const runtime = await import("cloudflare:workers");
  const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("redirects_database_unavailable");
  return db;
}

export async function redirectsDatabase(): Promise<D1Database> {
  const db = await redirectLookupDatabase();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_redirects (source_path TEXT PRIMARY KEY NOT NULL, target_path TEXT, status INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_redirect_events (id TEXT PRIMARY KEY NOT NULL, source_path TEXT NOT NULL, old_value TEXT, new_value TEXT NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL)`),
  ]);
  return db;
}

export async function redirectForPath(db: D1Database, path: string) {
  return db.prepare("SELECT source_path, target_path, status, active, updated_at, updated_by FROM vii_redirects WHERE source_path = ? AND active = 1").bind(path).first<RedirectRecord>();
}
