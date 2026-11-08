import assert from "node:assert/strict";
import test from "node:test";
import { executeQualityCheck, qualityRegistry } from "../app/lib/quality-platform.ts";

const check = qualityRegistry.find((item) => item.catalogMediaWorld === "vacations");
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("catalog media checker does not let an empty first room hide media in a later room", async () => {
  assert.ok(check);
  const requests = [];
  const result = await executeQualityCheck(check, "https://example.test", async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || "GET" });
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "image/jpeg", "content-length": "100" } });
    if (String(url).includes("&id=")) return json({ entry: { supplierId: Number(new URL(url).searchParams.get("id")), detail: { images: [], rooms: [{ images: [] }, { images: ["/api/vii/media/later-room.jpg"] }] } } });
    return json({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "passed", result.observed);
  assert.ok(requests.some(request => request.method === "HEAD" && request.url.endsWith("/later-room.jpg")), "later room media must be checked");
});

test("catalog media checker fails a detail that has general media but no unit media", async () => {
  assert.ok(check);
  const result = await executeQualityCheck(check, "https://example.test", async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "image/jpeg", "content-length": "100" } });
    if (String(url).includes("&id=")) return json({ entry: { supplierId: Number(new URL(url).searchParams.get("id")), detail: { images: ["/api/vii/media/general.jpg"], rooms: [{ images: [] }, { images: [] }] } } });
    return json({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "failed");
  assert.match(result.observed, /no_media/);
});

test("catalog media checker fails wrong detail identity even when catalog IDs are valid", async () => {
  const checks = qualityRegistry.filter(item => item.catalogMediaWorld === "vacations");
  const result = await executeQualityCheck(checks[0], "https://example.test", async (url) => {
    if (String(url).includes("&id=")) return json({ entry: { supplierId: 999, detail: { images: ["/api/vii/media/general.jpg"] } } });
    return json({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "failed");
  assert.match(result.observed, /identity/);
});

test("catalog media checker rejects a text/html response even when the body is JSON", async () => {
  const check = qualityRegistry.find(item => item.catalogMediaWorld === "vacations");
  const result = await executeQualityCheck(check, "https://example.test", async () => new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(result.status, "failed");
  assert.match(result.observed, /invalid_json_response/);
});

test("catalog media checker treats general and unit media independently", async () => {
  const check = qualityRegistry.find(item => item.catalogMediaWorld === "vacations");
  const result = await executeQualityCheck(check, "https://example.test", async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: String(url).endsWith("unit.jpg") ? 404 : 200, headers: { "content-type": "image/jpeg", "content-length": "100" } });
    if (String(url).includes("&id=")) return json({ entry: { supplierId: Number(new URL(url).searchParams.get("id")), detail: { images: ["/api/vii/media/general.jpg", "/api/vii/media/general2.jpg"], rooms: [{ images: ["/api/vii/media/unit.jpg"] }] } } });
    return json({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "failed");
  assert.match(result.observed, /media:404/);
});

for (const world of ["rooms", "spa"]) test(`catalog media checker accepts ${world} summary-only schema`, async () => {
  const check = qualityRegistry.find(item => item.catalogMediaWorld === world);
  const result = await executeQualityCheck(check, "https://example.test", async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "image/jpeg", "content-length": "100" } });
    if (String(url).includes("&id=")) return json({ entry: { supplierId: Number(new URL(url).searchParams.get("id")), detail: null, summary: { images: ["/api/vii/media/summary.jpg"] } } });
    return json({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "passed", result.observed);
});

test("catalog media checker fails closed on timeout", async () => {
  const check = qualityRegistry.find(item => item.catalogMediaWorld === "vacations");
  const result = await executeQualityCheck(check, "https://example.test", async () => { throw new Error("timed_out"); });
  assert.equal(result.status, "failed");
  assert.match(result.observed, /timed_out/);
});
