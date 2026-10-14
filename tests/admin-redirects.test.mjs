import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRedirectSource, parseRedirectInput, shouldCheckRedirect } from "../app/lib/admin-redirects.ts";
import { GET, POST } from "../app/api/admin/redirects/route.ts";

test("redirect editor rejects active routes, system paths and external targets", () => {
  const good = { sourcePath: "/legacy-villa-123", targetPath: "/villas/north", status: 301, active: true };
  assert.deepEqual(parseRedirectInput(good), good);
  for (const sourcePath of ["/admin", "/api/foo", "/search", "/spas/pool", "//external", "/x/../y"]) {
    assert.equal(parseRedirectInput({ ...good, sourcePath }), null, sourcePath);
  }
  for (const targetPath of ["https://evil.example", "//evil.example", "/admin", "/legacy-other", "/legacy-villa-123"]) {
    assert.equal(parseRedirectInput({ ...good, targetPath }), null, targetPath);
  }
  assert.equal(shouldCheckRedirect("/legacy-villa-123"), true);
  assert.equal(shouldCheckRedirect("/legacy-villa-123.html"), true);
  assert.equal(shouldCheckRedirect("/asset.png"), false);
  assert.equal(shouldCheckRedirect("/events/search/north"), false);
  assert.equal(normalizeRedirectSource("/s/?sett=508&attr=48"), "/s?attr=48&sett=508");
  assert.deepEqual(parseRedirectInput({ sourcePath: "/s/?sett=508&attr=48", targetPath: "/search?location=%D7%90%D7%99%D7%9C%D7%AA", status: 301, active: true }),
    { sourcePath: "/s?attr=48&sett=508", targetPath: "/search?location=%D7%90%D7%99%D7%9C%D7%AA", status: 301, active: true });
});

test("410 redirect has no target and can be saved as a draft", () => {
  assert.deepEqual(parseRedirectInput({ sourcePath: "/old-deleted", targetPath: "", status: 410, active: false }),
    { sourcePath: "/old-deleted", targetPath: null, status: 410, active: false });
});

test("redirect API denies anonymous reads and writes", async () => {
  const url = "https://vii.spaplus.co/api/admin/redirects";
  const get = await GET(new Request(url));
  assert.equal(get.status, 403);
  const post = await POST(new Request(url, { method: "POST", headers: { origin: "https://vii.spaplus.co", "Content-Type": "application/json" }, body: JSON.stringify({ sourcePath: "/old", targetPath: "/search", status: 301, active: true }) }));
  assert.equal(post.status, 403);
});
