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
  assert.equal(cards(normal), catalog.places.filter((place) => place.world === "events").length);
  assert.equal(cards(large), cards(normal));
});

test("regional event search returns actual supplier records", async () => {
  const html = await (await render(`/events/search?location=${encodeURIComponent("צפון")}`)).text();
  assert.match(html, /href="\/events\/place\/event-\d+"/);
});

test("all verified source URL identities redirect to the identical supplier record", async () => {
  for (const world of ["vacations", "events"]) {
    for (const old of world === "vacations" ? legacy.vacation : legacy.events) {
      const target = catalog.places.find((place) => place.world === world && place.sourceUrl === old.sourceUrl);
      if (!target) continue;
      const response = await render(world === "vacations" ? `/business?id=${old.id}` : `/events/place/${old.id}`);
      assert.equal(response.status, 307, old.id);
      const url = new URL(response.headers.get("location"), "https://vii.spaplus.co");
      assert.equal(world === "vacations" ? url.searchParams.get("id") : url.pathname.split("/").at(-1), target.slug, old.id);
    }
  }
});

test("missing legacy vacation records explain absence through relevant search without invented aliases", async () => {
  for (const id of ["vacation-tepers-estate", "vacation-aqua-sol-dreamy-rent", "vacation-ahuzat-shaked"]) {
    const old = legacy.vacation.find((place) => place.id === id);
    const response = await render(`/business?id=${id}&from=2026-10-10&guests=4&price=9999`);
    assert.equal(response.status, 307);
    const url = new URL(response.headers.get("location"), "https://vii.spaplus.co");
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("unavailable"), id);
    assert.equal(url.searchParams.get("location"), old.area);
    assert.equal(url.searchParams.get("from"), "2026-10-10");
    assert.equal(url.searchParams.get("guests"), "4");
    assert.equal(url.searchParams.has("price"), false);
    const search = await render(url.pathname + url.search);
    assert.equal(search.status, 200);
    const html = await search.text();
    assert.ok(html.includes(old.name));
    assert.match(html, /המקום אינו זמין בקטלוג הנוכחי/);
    assert.doesNotMatch(html, /business\?id=vacation-(?:tepers-estate|aqua-sol-dreamy-rent|ahuzat-shaked)/);
  }
});

test("unverified old aliases use search instead of silently adopting a supplier identity", async () => {
  for (const path of ["/business?id=aqua-resort", "/business?id=sol-gilgal", "/events/place/black-loft", "/events/place/fiesta", "/events/place/details-events"]) {
    const response = await render(path);
    assert.equal(response.status, 307, path);
    assert.match(response.headers.get("location"), /search\?unavailable=/);
  }
  assert.equal((await render("/business?id=not-a-known-record")).status, 404);
  assert.equal((await render("/events/place/not-a-known-record")).status, 404);
});

test("supplier event legacy redirects preserve locale", async () => {
  const old = legacy.events.find((old) => catalog.places.some((place) => place.world === "events" && place.sourceUrl === old.sourceUrl));
  const response = await render(`/en/events/place/${old.id}`);
  assert.equal(response.status, 307);
  assert.match(new URL(response.headers.get("location"), "https://vii.spaplus.co").pathname, /^\/en\/events\/place\/event-\d+$/);
});

test("vacation SSR honors region before hydration and old unsupported filters do not empty the catalog", async () => {
  const center = await (await render(`/search?location=${encodeURIComponent("מרכז")}`)).text();
  assert.doesNotMatch(center, /href="\/business\?id=vacation-1(?:["&])/);
  assert.match(center, /business\?id=vacation-\d+/);
  const normal = await (await render("/search")).text();
  const large = await (await render("/search?guests=1000&minPrice=9999&whole=1&types=villa")).text();
  const cards = (html) => [...html.matchAll(/href="\/business\?id=vacation-\d+"/g)].length;
  assert.ok(cards(normal) >= 15);
  assert.equal(cards(large), cards(normal));
  assert.match(large, /התאמה לכמות האורחים המבוקשת תיבדק מול המקום/);
  assert.doesNotMatch(large, />טווח מחיר<|>סוג מקום<|>מקום שלם<|>קיבולת גבוהה</);
});

test("unsupported taxonomy and missing-place booking preserve locale without old prices", async () => {
  for (const path of ["/en/villas/center", "/en/booking?world=vacation&place=vacation-tepers-estate&price=9999"]) {
    const response = await render(path);
    assert.equal(response.status, 307);
    const url = new URL(response.headers.get("location"), "https://vii.spaplus.co");
    assert.equal(url.pathname, "/en/search");
    assert.equal(url.searchParams.has("price"), false);
  }
});
