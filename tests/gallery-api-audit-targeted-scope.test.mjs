import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const job = await readFile(new URL("../app/lib/gallery-api-audit-job.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/admin/gallery-audit/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/admin/gallery-audit/page.tsx", import.meta.url), "utf8");

test("targeted audit scope is optional, bounded, and immutable", () => {
  assert.match(job, /scopeSupplierId\?: number/);
  assert.match(job, /scopeSupplierId !== undefined && \(!scopeWorld/);
  assert.match(job, /audit_scope_supplier_not_found/);
  assert.match(job, /previous\.value\.scopeSupplierId !== scopeSupplierId/);
  assert.match(job, /supplierId !== job\.scopeSupplierId/);
});

test("admin start validates targeted ID and UI exposes focused world action", () => {
  assert.match(route, /scopeSupplierId !== undefined/);
  assert.match(route, /Number\.isSafeInteger\(body\.scopeSupplierId\)/);
  assert.match(page, /מספר מקום לבדיקה ממוקדת/);
  assert.match(page, /בדיקה ממוקדת/);
  assert.match(page, /scopeSupplierId/);
});
