import test from "node:test";
import assert from "node:assert/strict";
import { acceptedSergeySummaries, acceptedSergeyDetail } from "../app/lib/accepted-bundled-catalog.ts";
import bedroomIndex from "../app/data/accepted-bedroom-index.json" with { type: "json" };
import sourceDetails from "../app/data/sergey-place-details.json" with { type: "json" };
import { readFileSync } from "node:fs";
import ts from "typescript";

test("accepted summaries stay available without requiring detail access", async () => {
  const summary = acceptedSergeySummaries("events").find((entry) => entry.supplierId === 1153);
  assert.ok(summary, "accepted summary must remain in the compact fallback");
  assert.equal(typeof summary.name, "string");
  const detail = await acceptedSergeyDetail("events", 1153);
  assert.equal(detail?.sourceUrl, "https://www.vii.co.il/events/Stay_Loft");
  assert.ok(Array.isArray(detail?.images), "detail loader must preserve the complete gallery");
});

test("compact bedroom index preserves every positive accepted detail total", () => {
  for (const [slug, detail] of Object.entries(sourceDetails.details)) {
    const expected = (Array.isArray(detail.rooms) ? detail.rooms : []).reduce((sum, room) => sum + (Number(room.bedrooms) || 0) * (Number(room.quantity) || 1), 0);
    assert.equal(Number(bedroomIndex[slug] || 0), expected > 0 ? expected : 0, slug);
  }
  assert.equal(bedroomIndex["vacation-11"], 5);
  assert.equal(bedroomIndex["vacation-28"], 14);
});

test("actual bundled list preserves bedroom facts without invoking any detail reader", async () => {
  const source = readFileSync(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "bundledEntries");
  assert.ok(declaration);
  const code = ts.transpileModule(declaration.getText(ast), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let detailCalls = 0;
  const list = new Function("ctx", `with(ctx){${code};return bundledEntries;}`)({acceptedSergeySummaries,bedroomIndex,acceptedSergeyDetail:()=>{detailCalls++;throw new Error("list may not hydrate detail");}});
  for (const world of ["vacations","events"]) {
    const rows = await list(world);
    const accepted = acceptedSergeySummaries(world);
    assert.deepEqual(rows.map(row=>row.supplierId),accepted.map(row=>row.supplierId));
    for (const row of rows) {
      const key = `${world === "vacations" ? "vacation" : "event"}-${row.supplierId}`;
      assert.equal(row.summary.bedrooms || 0,bedroomIndex[key] || 0,key);
    }
  }
  assert.equal(detailCalls,0);
});
