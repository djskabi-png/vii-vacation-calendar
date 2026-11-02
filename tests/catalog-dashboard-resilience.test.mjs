import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readSupplierCatalogDashboard } from "../app/lib/supplier-catalog-store.ts";

test("catalog dashboard serializes bridge statements and bounds historical payload", async () => {
  let active = false;
  const sql = [];
  const db = {
    prepare(statement) {
      sql.push(statement);
      return {
        async all() {
          assert.equal(active, false, "database statements must not overlap");
          active = true;
          await new Promise((resolve) => setTimeout(resolve, 2));
          active = false;
          return { results: statement.includes("supplier_catalog_state") ? [{ world: "vacations", activeCount: 1 }] : [] };
        },
      };
    },
  };

  const result = await readSupplierCatalogDashboard(db);
  assert.equal(result.states[0].world, "vacations");
  assert.equal(sql.length, 2);
  assert.doesNotMatch(sql[1], /diagnostics_json/);
});

test("catalog admin keeps core state visible when optional diagnostics fail", async () => {
  const route = await readFile(new URL("../app/api/admin/catalog-sync/route.ts", import.meta.url), "utf8");
  assert.match(route, /const dashboard = await readSupplierCatalogDashboard\(db\)/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /diagnosticsAvailability/);
});
