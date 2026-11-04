import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { cloudflareDatabaseForEnv, publicCatalogDatabaseForEnv, reportingDatabaseForEnv } from "../app/lib/runtime-database.ts";
import { databaseForEnv } from "../app/lib/aws-database.ts";

function d1() {
  return { prepare() { return { bind() { return this; }, async first() { return { ok: 1 }; },
    async all() { return { success: true, results: [] }; }, async run() { return { success: true }; } }; }, async batch() { return []; } };
}

for (const mode of [undefined, "cloudflare", "primary"]) {
  test(`all production database paths use the same D1 authority with legacy mode ${mode}`, async () => {
    const database = d1();
    const env = { DB: database, VII_AWS_DB_MODE: mode,
      VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "not-a-real-secret" };
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("AWS must not be contacted"); };
    try {
      assert.equal(cloudflareDatabaseForEnv(env), database);
      const [report, catalog] = await Promise.all([reportingDatabaseForEnv(env), publicCatalogDatabaseForEnv(env)]);
      for (const result of [report, catalog]) {
        assert.equal(result.database, database);
        assert.equal(result.origin, "cloudflare-d1");
        assert.equal(result.degraded, false);
      }
      assert.equal(calls, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
}

test("legacy adapters from either bundle unwrap to the real D1 binding", async () => {
  const database = d1();
  const env = { DB: database, VII_AWS_DB_MODE: "primary", VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "test" };
  const adapter = databaseForEnv(env);
  const foreignAdapter = { [Symbol.for("vii.awsDatabase.remoteAdapter")]: true,
    [Symbol.for("vii.awsDatabase.d1Fallback")]: database,
    prepare() { throw new Error("remote adapter must not run"); } };
  for (const DB of [adapter, foreignAdapter]) {
    assert.equal(cloudflareDatabaseForEnv({ ...env, DB }), database);
    assert.equal((await reportingDatabaseForEnv({ ...env, DB })).database, database);
  }
});

test("missing D1 binding fails closed without selecting a remote provider", async () => {
  assert.equal(cloudflareDatabaseForEnv({}), undefined);
  await assert.rejects(reportingDatabaseForEnv({}), /reporting_database_unavailable/);
  await assert.rejects(publicCatalogDatabaseForEnv({}), /public_catalog_database_unavailable/);
});

test("Worker requests and scheduled maintenance share the approved Cloudflare authority", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.equal((worker.match(/const database = cloudflareDatabaseForEnv\(env\)/g) || []).length, 2);
  assert.doesNotMatch(worker, /databaseForEnv\(|activateAwsDatabase\(|awsDatabaseMode\(/);
  assert.match(worker, /response\.headers\.set\("X-VII-Data-Origin", "cloudflare-d1"\)/);
});

test("no application entry point bypasses Cloudflare authority through the migration adapter", async () => {
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await scan(url);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && entry.name !== "aws-database.ts") {
        assert.doesNotMatch(await readFile(url, "utf8"), /\b(?:databaseForRuntimeEnv|databaseForEnv|activateAwsDatabase)\s*\(/, url.pathname);
      }
    }
  }
  await scan(new URL("../app/", import.meta.url));
  await scan(new URL("../worker/", import.meta.url));
});
