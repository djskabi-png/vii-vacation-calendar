import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
const legacy = JSON.parse(await readFile(new URL("../app/data/verified-catalog.json", import.meta.url)));
const { default: worker } = await import("../dist/server/index.js");
const render = (path) => worker.fetch(new Request(`https://vii.spaplus.co${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });

test("supplier vacation and event pages render without inferred capacity or accommodation taxonomy", async () => {
  for (const world of ["vacations", "events"]) {
    const place = catalog.places.find((place) => place.world === world);
    const response = await render(world === "vacations" ? `/business?id=${place.slug}` : `/events/place/${place.slug}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(place.name));
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
    const schema = schemas.find((schema) => ["LodgingBusiness", "EventVenue"].includes(schema["@type"]));
    assert.ok(schema);
    assert.equal(schema.maximumAttendeeCapacity, undefined);
    assert.equal(schema.containsPlace, undefined);
  }
});

test("an arbitrary URL price cannot authorize supplier booking", async () => {
  const place = catalog.places.find((place) => place.world === "vacations");
  const html = await (await render(`/booking?place=${place.slug}&from=2026-10-10&till=2026-10-12&price=987654&illustrative=1`)).text();
  assert.ok(!html.includes("987,654"));
  assert.ok(!html.includes("1,975,308"));
  assert.match(html, /חסר תאריך או מחיר להזמנה מקוונת/);
  assert.ok(!html.includes('id="booking-step-three-title"'));
});

test("exact legacy source identities redirect without carrying an old price", async () => {
  for (const world of ["vacations", "events"]) {
    const old = (world === "vacations" ? legacy.vacation : legacy.events).find((old) => catalog.places.some((place) => place.world === world && place.sourceUrl === old.sourceUrl));
    const target = catalog.places.find((place) => place.world === world && place.sourceUrl === old.sourceUrl);
    const response = await render(world === "vacations" ? `/business?id=${old.id}&price=100&from=2026-10-10` : `/events/place/${old.id}`);
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get("location"), "https://vii.spaplus.co");
    assert.ok(destination.href.includes(target.slug));
    assert.equal(destination.searchParams.has("price"), false);
  }
});

test("event attendance requests do not exclude places using lodging unit capacity", async () => {
  const normal = await (await render("/events/search")).text();
  const large = await (await render("/events/search?guests=1000&type=unverified&eventType=unverified")).text();
  const cards = (html) => [...html.matchAll(/href="\/events\/place\/event-\d+"/g)].length;
  assert.ok(cards(normal) >= 130);
  assert.equal(cards(large), cards(normal));
});

test("regional event search returns actual supplier records", async () => {
  const html = await (await render(`/events/search?location=${encodeURIComponent("צפון")}`)).text();
  assert.match(html, /href="\/events\/place\/event-\d+"/);
});
