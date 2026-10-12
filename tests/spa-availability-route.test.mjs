import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/spa/availability/route.ts";

test("spa availability rejects missing server-side token", async () => {
  const previous = process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN;
  delete process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN;
  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "availability_not_configured" });
  } finally {
    if (previous !== undefined) process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN = previous;
  }
});

test("spa availability exposes only validated slot counts, never the token", async () => {
  const previousToken = process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN = "test-secret";
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.get("key"), "test-secret");
    return Response.json({ status: "OK", data: { availability: [
      { siteID: 6, dateList: [{ date: "2026-10-13", available: 3 }, { date: "bad", available: 2 }] },
      { siteID: "invalid", dateList: [{ date: "2026-10-13", available: 5 }] },
    ] } });
  };
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.availability, [{ siteID: 6, date: "2026-10-13", available: 3 }]);
    assert.equal(JSON.stringify(body).includes("test-secret"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN;
    else process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN = previousToken;
  }
});
