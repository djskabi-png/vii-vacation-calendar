import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { adminEmails } from "./admin-access.ts";
import { parseAdminPermissions, type AdminAccess, type AdminPermissions } from "./admin-permissions.ts";

export type AdminGrant = { email: string; name: string; active: boolean; identityBound: boolean; manageUsers: boolean; permissions: AdminPermissions; version: number; updatedAt: string; updatedBy: string };
type AccessDatabase = Pick<D1Database, "prepare" | "batch">;
type GrantRow = { email: string; name: string; google_sub: string | null; active: number; manage_users: number; permissions_json: string; version: number; updated_at: string; updated_by: string };
export const adminGrantSchema = [
  `CREATE TABLE IF NOT EXISTS vii_admin_grants (email TEXT PRIMARY KEY, name TEXT NOT NULL, google_sub TEXT, active INTEGER NOT NULL CHECK(active IN (0,1)), manage_users INTEGER NOT NULL CHECK(manage_users IN (0,1)), permissions_json TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vii_admin_grant_audit (id TEXT PRIMARY KEY, email TEXT NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL)`,
] as const;

// Bootstrap managers must be existing explicitly configured administrators. No guessed identities.
export function accessManagerEmails() {
  const existing = adminEmails();
  return (process.env.VII_ACCESS_MANAGER_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter((v) => v && existing.includes(v));
}
export async function adminGrantDatabase(): Promise<D1Database> {
  return requiredRuntimeDatabase("admin_access_unavailable");
}
function primaryDatabase(db: D1Database): AccessDatabase {
  return typeof db.withSession === "function" ? db.withSession("first-primary") : db;
}
export async function ensureAdminGrantSchema(db: D1Database) {
  await db.batch(adminGrantSchema.map((sql) => db.prepare(sql)));
  const columns = await db.prepare("PRAGMA table_info(vii_admin_grants)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "google_sub")) {
    try { await db.prepare("ALTER TABLE vii_admin_grants ADD COLUMN google_sub TEXT").run(); }
    catch (error) {
      // Another request may have completed the same additive migration.
      const after = await db.prepare("PRAGMA table_info(vii_admin_grants)").all<{ name: string }>();
      if (!after.results.some((column) => column.name === "google_sub")) throw error;
    }
  }
}
function decode(row: GrantRow): AdminGrant {
  const permissions = parseAdminPermissions(JSON.parse(row.permissions_json));
  if (!permissions) throw new Error("invalid_stored_permissions");
  // Delegated grants never confer authority over other accounts. Only the two
  // explicitly configured access managers may grant or revoke access.
  return { email: row.email, name: row.name, active: row.active === 1, identityBound: !!row.google_sub, manageUsers: false, permissions, version: row.version, updatedAt: row.updated_at, updatedBy: row.updated_by };
}
export async function readAdminGrant(db: D1Database, email: string): Promise<AdminGrant | null> {
  const row = await primaryDatabase(db).prepare("SELECT * FROM vii_admin_grants WHERE email = ?").bind(email.trim().toLowerCase()).first<GrantRow>();
  return row ? decode(row) : null;
}
export async function resolveAdminAccess(email: string, database = adminGrantDatabase, googleSubject?: string): Promise<AdminAccess | null> {
  const normalized = email.trim().toLowerCase();
  const manager = accessManagerEmails().includes(normalized);
  // Full platform access belongs only to the explicitly configured owners.
  if (manager) return { fullAccess: true, manageUsers: true, permissions: {} };
  try {
    const db = primaryDatabase(await database());
    let row = await db.prepare("SELECT * FROM vii_admin_grants WHERE email = ?").bind(normalized).first<GrantRow>();
    if (!row?.active) return null;
    if (!row.google_sub) {
      if (!googleSubject || googleSubject.length > 255) return null;
      const now = new Date().toISOString();
      const before = decode(row);
      const after = { ...before, identityBound: true, version: before.version + 1, updatedAt: now, updatedBy: normalized };
      await db.batch([
        db.prepare("UPDATE vii_admin_grants SET google_sub = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE email = ? AND google_sub IS NULL AND active = 1 AND version = ?")
          .bind(googleSubject, now, normalized, normalized, before.version),
        db.prepare("INSERT INTO vii_admin_grant_audit(id,email,action,before_json,after_json,actor,created_at) SELECT ?,?,?,?,?,?,? WHERE changes() = 1")
          .bind(crypto.randomUUID(), normalized, "identity_bound", JSON.stringify(before), JSON.stringify(after), normalized, now),
      ]);
      row = await db.prepare("SELECT * FROM vii_admin_grants WHERE email = ?").bind(normalized).first<GrantRow>();
    }
    if (!row?.active || !row.google_sub || (googleSubject !== undefined && row.google_sub !== googleSubject)) return null;
    const grant = decode(row);
    return { fullAccess: false, manageUsers: false, permissions: grant.permissions };
  } catch { return null; } // Storage failure never falls back to a stale or browser-supplied grant.
}

export function parseAdminGrantChange(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const permissions = parseAdminPermissions(row.permissions);
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) || email.length > 254
    || !name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) || !permissions
    || typeof row.active !== "boolean" || row.manageUsers !== false || !Number.isSafeInteger(row.version) || Number(row.version) < 0
    || row.confirmed !== true || (!Object.keys(permissions).length && row.active)) return null;
  return { email, name, permissions, active: row.active, manageUsers: false, version: Number(row.version) };
}

export class AdminGrantError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}
export async function saveAdminGrant(db: D1Database, input: NonNullable<ReturnType<typeof parseAdminGrantChange>>, actor: string) {
  const actorEmail = actor.trim().toLowerCase();
  const actorAccess = await resolveAdminAccess(actorEmail, async () => db);
  if (!actorAccess?.manageUsers) throw new AdminGrantError("forbidden", 403);
  if (input.email === actorEmail || accessManagerEmails().includes(input.email)) throw new AdminGrantError("protected_account", 403);
  const before = await readAdminGrant(db, input.email);
  if ((before?.version || 0) !== input.version) throw new AdminGrantError("version_conflict", 409);
  const record: AdminGrant = { email: input.email, name: input.name, active: input.active, identityBound: before?.identityBound || false, manageUsers: false,
    permissions: input.permissions, version: input.version + 1, updatedAt: new Date().toISOString(), updatedBy: actorEmail };
  const op = crypto.randomUUID();
  const bootstrapManager = accessManagerEmails().includes(actorEmail);
  // Optimistic version check and audit occur in the same D1 batch transaction.
  const result = await db.batch([
    db.prepare(`INSERT INTO vii_admin_grants(email,name,active,manage_users,permissions_json,version,updated_at,updated_by)
      SELECT ?,?,?,?,?,?,?,? WHERE (? = 1 OR EXISTS (SELECT 1 FROM vii_admin_grants WHERE email = ? AND active = 1 AND manage_users = 1))
      ON CONFLICT(email) DO UPDATE SET name=excluded.name,active=excluded.active,
      manage_users=excluded.manage_users,permissions_json=excluded.permissions_json,version=excluded.version,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE vii_admin_grants.version = ?`)
      .bind(record.email, record.name, Number(record.active), Number(record.manageUsers), JSON.stringify(record.permissions), record.version, record.updatedAt, actorEmail, Number(bootstrapManager), actorEmail, input.version),
    db.prepare(`INSERT INTO vii_admin_grant_audit(id,email,action,before_json,after_json,actor,created_at)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS (
        SELECT 1 FROM vii_admin_grants WHERE email = ? AND version = ? AND updated_by = ? AND updated_at = ?
      )`).bind(op, input.email, !input.active ? "revoke" : before ? "update" : "grant", before ? JSON.stringify(before) : null, JSON.stringify(record), actorEmail, record.updatedAt,
        record.email, record.version, actorEmail, record.updatedAt),
  ]);
  if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1) throw new AdminGrantError("version_conflict", 409);
  const persisted = await readAdminGrant(db, input.email);
  const audit = await db.prepare("SELECT id FROM vii_admin_grant_audit WHERE id = ?").bind(op).first<{ id: string }>();
  if (!persisted || persisted.version !== record.version || !audit) throw new Error("admin_access_readback_failed");
  return { grant: persisted, auditId: audit.id };
}

export async function readAdminGrantDashboard(db: D1Database) {
  const primary = primaryDatabase(db);
  const [grants, audit] = await Promise.all([
    primary.prepare("SELECT * FROM vii_admin_grants ORDER BY active DESC, email LIMIT 500").all<GrantRow>(),
    primary.prepare("SELECT id,email,action,actor,created_at AS createdAt FROM vii_admin_grant_audit ORDER BY created_at DESC, id DESC LIMIT 50").all(),
  ]);
  return { grants: grants.results.map(decode), audit: audit.results,
    protectedAccounts: accessManagerEmails().map((email) => ({ email, manageUsers: true })) };
}
