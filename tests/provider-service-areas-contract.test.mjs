import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync(new URL("../app/lib/provider-service-areas.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/providers/near-me/page.tsx", import.meta.url), "utf8");
const copy = fs.readFileSync(new URL("../app/lib/nearby-page-content.ts", import.meta.url), "utf8");

test("provider nearby uses verified geographic service areas", () => {
  assert.match(helper, /verifiedServiceAreas/);
  assert.match(helper, /"צפון"/);
  assert.match(helper, /"כל הארץ"/);
  assert.match(page, /hasVerifiedProviderServiceArea\(item\.serviceAreas\)/);
  assert.doesNotMatch(helper, /צילום אירועים/);
});

test("provider nearby copy does not promise GPS distance", () => {
  const section = copy.slice(copy.indexOf("providers:"), copy.indexOf("},\n} as const"));
  assert.match(section, /בחרו אזור/);
  assert.match(section, /לא על מרחק GPS מדויק/);
  assert.doesNotMatch(section, /אשרו מיקום/);
});
