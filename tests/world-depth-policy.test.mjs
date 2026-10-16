import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { depthQuery, depthLocationParam, defaultDepthSuggestions, depthTopicKey, secondaryDepthLayers, providerDepthLocation } from "../app/lib/world-depth-policy.ts";

test("each world carries only its own supported query and never business identity or tracking", () => {
  for (const world of ["vacation", "events", "spa", "hourly", "providers", "activities", "trails"]) {
    const params = depthQuery(world, "id=private&source=email&release=452&gallery=3&from=2026-12-10&till=2026-12-12&to=2026-12-12&spaFor=couple&nature=מים", {}, "מרכז");
    for (const key of ["id", "source", "release", "gallery"]) assert.equal(params.has(key), false);
    assert.equal(params.get(depthLocationParam(world)), "מרכז");
    assert.equal(params.has("till"), world === "vacation");
    assert.equal(params.has("to"), world === "events");
    assert.equal(params.has("spaFor"), world === "spa");
    assert.equal(params.has("nature"), world === "trails");
  }
});

test("changing a depth category retains dates and audience; country clears only location", () => {
  const params = depthQuery("vacation", "from=2026-12-10&till=2026-12-12&guests=6&pool=1", { type: "וילה" }, "נתניה");
  assert.equal(params.get("guests"), "6");
  assert.equal(params.get("pool"), "1");
  assert.equal(params.get("location"), "נתניה");
  assert.equal(depthQuery("vacation", params.toString(), { location: null }).has("location"), false);
  const type = defaultDepthSuggestions("vacation", [{ location: "נתניה", area: "מרכז", type: "וילה" }])[0];
  const changed = depthQuery("vacation", "types=צימרים,דירות&guests=6", type.params);
  assert.equal(changed.has("types"), false);
  assert.equal(changed.get("type"), "וילה");
});

test("provider depth uses real category paths and region, not ignored area", () => {
  assert.equal(depthLocationParam("providers"), "region");
  const suggestions = defaultDepthSuggestions("providers", []);
  assert.equal(suggestions.length, 7);
  for (const item of suggestions) assert.match(item.path, /^\/providers\/[a-z]+$/);
  assert.equal(depthQuery("providers", "area=צפון&region=מרכז&q=שף").get("area"), null);
  assert.deepEqual(secondaryDepthLayers("providers", "מרכז", [{ location: "עיר", area: "שף", serviceAreas: ["מרכז", "צפון"] }]).suitableRegions, ["צפון"]);
  assert.deepEqual(secondaryDepthLayers("providers", undefined, [{ location: "קריית עקרון", area: "תקליטן", serviceAreas: ["תקליטן ויוצר מוזיקלי", "קריית עקרון"] }]).suitableRegions, []);
  assert.equal(providerDepthLocation(["צפון", "מרכז"]), undefined);
  assert.equal(providerDepthLocation(["צילום", "מרכז"]), "מרכז");
});

test("attraction types and trail natures come from normalized verified fields", () => {
  assert.deepEqual(defaultDepthSuggestions("activities", [{ location: "צפון", area: "צפון", type: "טבע ורכיבה" }])[0].params, { type: "טבע ורכיבה" });
  const trails = defaultDepthSuggestions("trails", [{ location: "גליל", area: "צפון", nature: ["מים"], difficulty: "קל" }]);
  assert.deepEqual(trails.map(item => item.params), [{ nature: "מים" }, { difficulty: "קל" }]);
});

test("topic visuals communicate actual meaning instead of repeating a location pin", () => {
  const cases = [["ספא עם בריכה", "pool"], ["ספא זוגי", "heart"], ["חבילה עם ארוחה", "meal"], ["מוזיקה", "music"], ["צילום", "camera"], ["צפון", "forest"], ["מרכז", "city"], ["ירושלים", "landmark"], ["כניסה עצמאית", "key"], ["חדרים עם חניה", "parking"]];
  for (const [label, key] of cases) assert.equal(depthTopicKey(label, "spa"), key);
  const renderer = readFileSync(new URL("../app/components/search-after-results.tsx", import.meta.url), "utf8");
  assert.match(renderer, /<DepthTopicIcon topic=/);
  assert.doesNotMatch(renderer, /M12 21s7-5/);
});

test("all business templates receive the same scoped depth system without duplicate guides", () => {
  for (const file of ["business/client-page.tsx", "events/place/client-page.tsx", "discover/place/client-page.tsx", "trails/[slug]/page.tsx"]) {
    const source = readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8");
    assert.match(source, /<SearchAfterResults[^>]*discoveryOnly/);
    assert.match(source, /inventory=/);
  }
});

test("city names and spa intent are localized as places and experiences, not dictionary homonyms", () => {
  const copy = JSON.parse(readFileSync(new URL("../app/data/world-depth-translations.json", import.meta.url), "utf8"));
  assert.equal(copy["רחובות"].en, "Rehovot");
  assert.equal(copy["רעננה"].en, "Ra'anana");
  assert.equal(copy["צפת"].fr, "Safed");
  assert.equal(copy["ספא זוגי"].en, "Spa for couples");
  for (const phrase of ["סוג השירות", "סוג טבע", "סוג חוויה"]) for (const language of ["en", "ru", "fr"]) assert.ok(copy[phrase][language]);
});
