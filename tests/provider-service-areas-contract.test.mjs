import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const { providerGeographicServiceAreas, providerServesRegion } = await import("../app/lib/provider-service-areas.ts");

const helper = fs.readFileSync(new URL("../app/lib/provider-service-areas.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/providers/near-me/page.tsx", import.meta.url), "utf8");
const copy = fs.readFileSync(new URL("../app/lib/nearby-page-content.ts", import.meta.url), "utf8");

test("provider nearby uses verified geographic service areas", () => {
  assert.match(helper, /verifiedServiceAreas/);
  assert.match(helper, /"צפון"/);
  assert.match(helper, /"כל הארץ"/);
  assert.match(page, /hasVerifiedProviderServiceArea\(item\.serviceAreas\)/);
  assert.doesNotMatch(helper, /צילום אירועים/);
  assert.match(helper, /providerGeographicServiceAreas/);
});

test("provider nearby copy does not promise GPS distance", () => {
  const section = copy.slice(copy.indexOf("providers:"), copy.indexOf("},\n} as const"));
  assert.match(section, /בחרו אזור/);
  assert.match(section, /לא על מרחק GPS מדויק/);
  assert.doesNotMatch(section, /אשרו מיקום/);
});

test("provider region matching excludes professions and supports nationwide coverage", () => {
  assert.deepEqual(providerGeographicServiceAreas(["עיצוב והפקת אירועים", "יקיר והשומרון"]), ["יקיר והשומרון"]);
  assert.equal(providerServesRegion(["כל הארץ"], "צפון"), true);
  assert.equal(providerServesRegion(["בכל הארץ"], "דרום ונגב"), true);
  assert.equal(providerServesRegion(["יקיר והשומרון"], "צפון"), false);
  assert.equal(providerServesRegion(["יקיר והשומרון"], "יקיר והשומרון"), true);
});
