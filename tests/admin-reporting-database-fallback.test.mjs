import test from "node:test";
import assert from "node:assert/strict";
import { publicCatalogDatabaseForEnv, reportingDatabaseForEnv,
  resetPublicCatalogDatabaseCircuitForTests } from "../app/lib/runtime-database.ts";
import { databaseForEnv } from "../app/lib/aws-database.ts";

function d1() {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return { ok: 1 }; },
        async all() { return { success: true, results: [] }; },
        async run() { return { success: true, meta: { changes: 0 } }; },
      };
    },
    async batch() { return []; },
  };
}

test("admin reporting stays available on the D1 replica when the Aurora bridge is down", async () => {
  const fallback = d1();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ ok: false, error: "database_operation_failed" }, { status: 500 }); };
  try {
    const result = await reportingDatabaseForEnv({ DB: fallback, VII_AWS_DB_MODE: "primary",
      VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" });
    assert.equal(result.database, fallback);
    assert.equal(result.origin, "cloudflare-d1");
    assert.equal(result.degraded, true);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("admin reporting keeps Aurora when the bridge health probe succeeds", async () => {
  const fallback = d1();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, results: [{ success: true, results: [{ ok: 1 }], meta: {} }] });
  try {
    const result = await reportingDatabaseForEnv({ DB: fallback, VII_AWS_DB_MODE: "primary",
      VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" });
    assert.notEqual(result.database, fallback);
    assert.equal(result.origin, "aws-aurora");
    assert.equal(result.degraded, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("admin reporting unwraps an Aurora adapter exposed through a fresh Worker Env facade", async () => {
  const fallback = d1();
  const configured = { DB: fallback, VII_AWS_DB_MODE: "primary",
    VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" };
  const adapter = databaseForEnv(configured);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ ok: false }, { status: 500 }); };
  try {
    const result = await reportingDatabaseForEnv({ ...configured, DB: adapter });
    assert.equal(result.database, fallback);
    assert.equal(result.origin, "cloudflare-d1");
    assert.equal(result.degraded, true);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("admin reporting unwraps an Aurora adapter created by a separate bundle instance", async () => {
  const fallback = d1();
  const remoteAdapterMarker = Symbol.for("vii.awsDatabase.remoteAdapter");
  const d1FallbackMarker = Symbol.for("vii.awsDatabase.d1Fallback");
  const foreignAdapter = {
    [remoteAdapterMarker]: true,
    [d1FallbackMarker]: fallback,
    prepare() {
      return { async first() { throw new Error("VII AWS database bridge returned 500"); } };
    },
  };
  const result = await reportingDatabaseForEnv({ DB: foreignAdapter, VII_AWS_DB_MODE: "primary",
    VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" });
  assert.equal(result.database, fallback);
  assert.equal(result.origin, "cloudflare-d1");
  assert.equal(result.degraded, true);
});

test("public catalog opens a bounded circuit and serves accepted D1 data while Aurora is down", async () => {
  resetPublicCatalogDatabaseCircuitForTests();
  const fallback = d1();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ ok: false, error: "database_operation_failed" }, { status: 500 });
  };
  const env = { DB: fallback, VII_AWS_DB_MODE: "primary",
    VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" };
  try {
    const first = await publicCatalogDatabaseForEnv(env, 1_000);
    const second = await publicCatalogDatabaseForEnv(env, 2_000);
    assert.equal(first.database, fallback);
    assert.equal(first.origin, "cloudflare-d1");
    assert.equal(first.degraded, true);
    assert.equal(second.database, fallback);
    assert.equal(second.degraded, true);
    assert.equal(calls, 2, "only the first failed read performs the adapter's bounded retry");
  } finally {
    globalThis.fetch = originalFetch;
    resetPublicCatalogDatabaseCircuitForTests();
  }
});

test("public catalog coalesces concurrent Aurora probes", async () => {
  resetPublicCatalogDatabaseCircuitForTests();
  const fallback = d1();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ ok: true, results: [{ success: true, results: [{ ok: 1 }], meta: {} }] });
  };
  const env = { DB: fallback, VII_AWS_DB_MODE: "primary",
    VII_AWS_DB_ENDPOINT: "https://bridge.example.test", VII_AWS_DB_TOKEN: "secret" };
  try {
    const [first, second] = await Promise.all([
      publicCatalogDatabaseForEnv(env, 1_000), publicCatalogDatabaseForEnv(env, 1_000),
    ]);
    assert.equal(first.origin, "aws-aurora");
    assert.equal(second.origin, "aws-aurora");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetPublicCatalogDatabaseCircuitForTests();
  }
});
