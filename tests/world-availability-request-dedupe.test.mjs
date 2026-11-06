import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("world availability dedupes the actual D1 read and invalidates after mutation", async () => {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const dir = mkdtempSync(join(tmpdir(), "vii-world-availability-"));
  try {
    writeFileSync(join(dir, "runtime-database-fixture.mjs"), `export async function requiredRuntimeDatabase(){return globalThis.__worldDb}`);
    let source = readFileSync(resolve(root, "app/lib/world-availability.ts"), "utf8");
    source = source.replace(/from "\.\/runtime-database\.ts";/, `from "${pathToFileURL(join(dir, "runtime-database-fixture.mjs")).href}";`);
    source = source.replace(/from "\.\/server-request-reads\.ts";/, `from "${pathToFileURL(resolve(root, "app/lib/server-request-reads.ts")).href}";`);
    const modulePath = join(dir, "world-availability-fixture.ts");
    writeFileSync(modulePath, source);
    let selects = 0;
    let enabled = 1;
    const db = { prepare(sql) { return { async all() { if (sql.startsWith("SELECT world")) selects++; return { results: [{ world: "vacation", enabled }] }; }, bind() { return this; }, async run() { return { meta: { changes: 1 } }; } }; }, async batch() { return []; } };
    globalThis.__worldDb = db;
    const mod = await import(`${pathToFileURL(modulePath).href}?case=${Date.now()}`);
    const requestReads = await import(pathToFileURL(resolve(root, "app/lib/server-request-reads.ts")).href);
    await requestReads.withServerRequestReads(async () => {
      const [first, second] = await Promise.all([mod.readWorldAvailability(), mod.readWorldAvailability()]);
      assert.equal(first.vacation, true);
      assert.equal(second.vacation, true);
      assert.equal(selects, 1, "concurrent layout/home reads share one SELECT");
      first.vacation = false;
      assert.equal(second.vacation, true, "each caller receives an independent state copy");
      enabled = 0;
      await mod.setWorldAvailability("vacation", false, "test");
      const after = await mod.readWorldAvailability();
      assert.equal(after.vacation, false);
    });
    assert.equal(selects, 2, "one SELECT before and one after the mutation");
  } finally { delete globalThis.__worldDb; rmSync(dir, { recursive: true, force: true }); }
});
