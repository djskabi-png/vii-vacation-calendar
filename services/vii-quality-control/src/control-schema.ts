import type { D1Database } from "../../../types/cloudflare-runtime";
import { initializeSchemaOnce } from "../../../app/lib/schema-initializer.ts";

export function ensureControlAuxiliarySchema(db: D1Database) {
  return initializeSchemaOnce(db,'quality-control-auxiliary-v1',async()=>{
    await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS quality_authorization_nonces (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS quality_queue_failures (message_id TEXT PRIMARY KEY,run_id TEXT,source_version TEXT,reason TEXT NOT NULL,attempts INTEGER NOT NULL,recorded_at TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS quality_scheduler_reconciliation_audit (id TEXT PRIMARY KEY,check_id TEXT NOT NULL,bucket INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,run_id TEXT,created_at INTEGER NOT NULL)"),
    ]);
  });
}
