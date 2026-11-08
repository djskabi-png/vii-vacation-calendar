import assert from "node:assert/strict";
import test from "node:test";
import { executeQualityCheck, qualityRegistry } from "../app/lib/quality-platform.ts";

const checks = qualityRegistry.filter((check) => check.catalogMediaWorld);
const detail = (id, general = "/api/vii/media/a.jpg", room = "/api/vii/media/b.jpg") => ({ entry: { supplierId: id, detail: { images: [general], rooms: [{ images: [room] }] } } });
const response = (body, status = 200, type = "application/json") => new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

test("catalog-media checks sample three IDs and fail closed on media 404", async () => {
  assert.equal(checks.length, 4);
  let calls = 0;
  const result = await executeQualityCheck(checks[0], "https://example.test", async (url, init = {}) => {
    calls++;
    if (init.method === "HEAD") return new Response(null, { status: 404, headers: { "content-type": "text/plain" } });
    if (String(url).includes("&id=")) return response(detail(Number(new URL(url).searchParams.get("id"))));
    return response({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "failed");
  assert.match(result.observed, /media:404/);
  assert.ok(calls >= 4);
});

test("catalog-media checks pass only with strict raster image MIME", async () => {
  const result = await executeQualityCheck(checks[3], "https://example.test", async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } });
    if (String(url).includes("&id=")) return response(detail(Number(new URL(url).searchParams.get("id")), "https://www.spaplus.co.il/gallery/a.jpg", "https://www.spaplus.co.il/gallery/b.jpg"));
    return response({ entries: [{ supplierId: 1 }, { supplierId: 2 }, { supplierId: 3 }] });
  });
  assert.equal(result.status, "passed");
});

test("catalog-media fails wrong detail identity and invalid mixed IDs", async () => {
  const wrong = await executeQualityCheck(checks[0], "https://example.test", async (url) => {
    if (String(url).includes("&id=")) return response(detail(999));
    return response({ entries: [{ supplierId: 1 }, { name: "bad" }, { supplierId: 3 }] });
  });
  assert.equal(wrong.status, "failed");
});

test("catalog-media rejects JSON/HTML MIME and external media hosts", async () => {
  const result = await executeQualityCheck(checks[0], "https://example.test", async (url, init = {}) => {
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "text/html" } });
    if (String(url).includes("&id=")) return response(detail(Number(new URL(url).searchParams.get("id")), "https://evil.example/a.jpg", "https://evil.example/b.jpg"));
    return new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
  });
  assert.equal(result.status, "failed");
});

test("catalog-media fails empty or invalid catalogs instead of swallowing them", async () => {
  for (const body of [{ entries: [] }, { entries: [{ name: "missing id" }] }]) {
    const result = await executeQualityCheck(checks[2], "https://example.test", async () => response(body));
    assert.equal(result.status, "failed");
  }
});
