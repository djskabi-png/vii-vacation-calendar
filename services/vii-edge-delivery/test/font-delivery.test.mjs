import assert from "node:assert/strict";
import test from "node:test";
import { deliverPublicRubikFont } from "../src/font-delivery.ts";

const font = "https://vii.spaplus.co/fonts/rubik/rubik-hebrew-v31.woff2";

test("public Rubik fonts receive the production MIME and immutable cache policy", async () => {
  const response = deliverPublicRubikFont(new Request(font), new Response("font", { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "max-age=0", ETag: "x" } }));
  assert.equal(response.headers.get("Content-Type"), "font/woff2");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("ETag"), "x");
  assert.equal(await response.text(), "font");
});

test("font delivery is restricted to exact public paths and successful responses", async () => {
  const original = new Response("not-found", { status: 404, headers: { "Content-Type": "application/octet-stream" } });
  assert.equal(deliverPublicRubikFont(new Request(font), original), original);
  assert.equal(deliverPublicRubikFont(new Request("https://vii.spaplus.co/fonts/rubik/other.woff2"), new Response("x")).headers.get("Cache-Control"), null);
  assert.equal(deliverPublicRubikFont(new Request("https://worker.example/fonts/rubik/rubik-hebrew-v31.woff2"), new Response("x")).headers.get("Cache-Control"), null);
  assert.equal(deliverPublicRubikFont(new Request(font, { method: "POST" }), new Response("x")).headers.get("Cache-Control"), null);
});
