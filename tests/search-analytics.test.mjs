import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchEvent } from "../app/lib/search-analytics.ts";
import { POST } from "../app/api/analytics/search/route.ts";
import { GET } from "../app/api/admin/search-analytics/route.ts";

const eventId = "d5e63378-217c-4c08-9f62-7bccb8b4fd2e";

test("search event normalizes unknown free text without keeping personal input", () => {
  assert.deepEqual(parseSearchEvent({ eventId, world: "spa", location: "מרכז", hasDate: true }), { eventId, world: "spa", location: "מרכז", hasDate: true });
  assert.equal(parseSearchEvent({ eventId, world: "spa", location: "name@example.com", hasDate: true })?.location, "אחר");
  assert.equal(parseSearchEvent({ eventId, world: "invalid", location: "מרכז", hasDate: true }), null);
});

test("search ingestion rejects cross-origin and malformed requests before storage", async () => {
  const url = "https://vii.spaplus.co/api/analytics/search";
  const crossOrigin = await POST(new Request(url, { method: "POST", headers: { origin: "https://foreign.example" }, body: "{}" }));
  assert.equal(crossOrigin.status, 403);
  const invalid = await POST(new Request(url, { method: "POST", headers: { origin: "https://vii.spaplus.co" }, body: JSON.stringify({ eventId, world: "spa", location: "מרכז" }) }));
  assert.equal(invalid.status, 400);
});

test("search report is restricted to administrators", async () => {
  const response = await GET(new Request("https://vii.spaplus.co/api/admin/search-analytics?days=7"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
