import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/api/admin/booking-readiness/route.ts", import.meta.url), "utf8");

test("booking readiness is admin-only and read-only", () => {
  assert.match(source, /authorizedAdminSession/);
  assert.match(source, /export async function GET/);
  assert.doesNotMatch(source, /export async function POST/);
  assert.doesNotMatch(source, /\/booking[`?]/);
});

test("booking readiness verifies search, exact room and exact vacancy quote", () => {
  assert.match(source, /vacations\/search/);
  assert.match(source, /cheapest\.from !== from/);
  assert.match(source, /rooms\.length !== 1/);
  assert.match(source, /vacations\/\$\{siteID\}\/vacancy/);
  assert.match(source, /vacancy\.onlineBooking !== true/);
  assert.match(source, /currency: "ILS"/);
});

test("booking readiness accepts only published supplier sites", () => {
  assert.match(source, /publishedSupplierIds\("vacations"\)/);
  assert.match(source, /not_published/);
});
