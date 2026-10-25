import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { supplierStayUnitQuotes } from "../app/lib/vii-unit-quotes.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer navigation never starts catalog or QQQAAA maintenance", async () => {
  const worker = await read("worker/index.ts");
  const fetchBody = worker.slice(worker.indexOf("async fetch("));
  assert.doesNotMatch(fetchBody, /visitor catalog heartbeat|visitor quality heartbeat|qualityHeartbeatWindow|shouldStartQualityHeartbeat/);
  const scheduled = worker.slice(worker.indexOf("scheduled("), worker.indexOf("async fetch("));
  assert.match(scheduled, /runQualityChecks/);
  assert.match(scheduled, /runSupplierCatalogScheduleTick/);
});

test("global boundary recovers a release asset mismatch once without looping", async () => {
  const boundary = await read("app/error.tsx");
  assert.match(boundary, /isReleaseAssetMismatch/);
  assert.match(boundary, /RECOVERY_WINDOW_MS = 60_000/);
  assert.match(boundary, /startsWith\("vii-public-"\)/);
  assert.match(boundary, /location\.reload\(\)/);
});

test("unit quote fan-out preserves every room and isolates one supplier failure", async () => {
  const active = 0;
  const results = await supplierStayUnitQuotes({
    roomIDs: [11, 12, 13], concurrency: 2,
    quote: async (roomID) => {
      assert.equal(active, 0);
      if (roomID === 12) throw Error("supplier_unavailable");
      return { status: "available", total: roomID * 100 };
    },
  });
  assert.deepEqual(results, [
    { roomID: 11, status: "available", total: 1100 },
    { roomID: 12, status: "unverified", reason: "supplier_unavailable" },
    { roomID: 13, status: "available", total: 1300 },
  ]);
});

test("business cards consume room-scoped quotes and preserve exact room booking IDs", async () => {
  const [business, hook, route] = await Promise.all([
    read("app/business/client-page.tsx"), read("app/components/use-vii-unit-quotes.ts"), read("app/api/vii/stay-unit-quotes/route.ts"),
  ]);
  assert.match(business, /useViiUnitQuotes/);
  assert.match(business, /supplierUnitQuotes\.quotes\[room\.supplierRoomID\]/);
  assert.match(business, /unitBookingQuery\.set\("roomID", String\(room\.supplierRoomID\)\)/);
  assert.match(hook, /value\.units\.length !== requested\.length/);
  assert.match(route, /supplierStayUnitQuotes/);
  assert.match(route, /concurrency: 4/);
});
