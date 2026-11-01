import assert from "node:assert/strict";
import test from "node:test";
import { requestOriginMatches } from "../app/lib/request-origin.ts";

test("world control accepts the public origin behind the production proxy", () => {
  const request = new Request("https://internal-worker.local/api/admin/worlds", { headers: {
    origin: "https://vii.spaplus.co",
    host: "internal-worker.local",
    "x-forwarded-host": "vii.spaplus.co",
    "x-forwarded-proto": "https",
  } });
  assert.equal(requestOriginMatches(request), true);
});

test("world control still rejects a foreign origin", () => {
  const request = new Request("https://internal-worker.local/api/admin/worlds", { headers: {
    origin: "https://attacker.example",
    "x-forwarded-host": "vii.spaplus.co",
    "x-forwarded-proto": "https",
  } });
  assert.equal(requestOriginMatches(request), false);
});
