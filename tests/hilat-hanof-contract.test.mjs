import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const sources = await readFile(resolve(root, "app/lib/legacy-availability-sources.ts"), "utf8");

test("Hilat HaNof is a verified four-cabin legacy property", async () => {
  const catalog = await readFile(resolve(root, "app/data/site-data.ts"), "utf8");
  const profiles = await readFile(resolve(root, "app/data/legacy-vacation-profiles.ts"), "utf8");
  const start = catalog.indexOf('slug: "hilat-hanof"');
  const end = catalog.indexOf('slug: "ar-suites"', start);
  const listing = catalog.slice(start, end);

  assert.ok(start > 0 && end > start);
  assert.match(listing, /name: "הילת הנוף"/);
  assert.match(listing, /units: 4/);
  assert.match(listing, /guests: 25/);
  assert.match(listing, /scenario: "multi"/);
  assert.match(listing, /reviewSource: "legacy-verified"/);
  assert.match(listing, /contact: \{ phone: "052-9097258", whatsapp: "052-9097258" \}/);
  assert.match(listing, /price: 850/);
  assert.match(listing, /dailyAvailability: hilatHanofDailyAvailability/);
  assert.match(listing, /from: "2026-09-04", till: "2026-09-06", availability: "available", nightlyPrice: 800/);
  assert.match(listing, /from: "2026-10-02", till: "2026-10-04", availability: "available", nightlyPrice: 1200/);
  assert.match(listing, /validFrom: "2026-08-14"/);
  assert.match(listing, /validThrough: "2026-10-14"/);
  assert.match(listing, /תמונת מצב יומית מהמקור הישן/);
  assert.match(listing, /מינימום לילות לפי יום ההגעה/);
  for (const cabin of [1, 2, 3, 4]) assert.match(listing, new RegExp(`name: "בקתה ${cabin}"`));

  assert.match(profiles, /"hilat-hanof": \{/);
  assert.match(profiles, /sourceUrl: "https:\/\/www\.vii\.co\.il\/hilat_hanof"/);
  assert.match(profiles, /reviewCount: 180/);
  assert.match(profiles, /verifiedStartingPrice: 850/);
  assert.match(profiles, /checkedAt: "2026-08-14"/);
});

test("Hilat HaNof keeps the verified two-month availability snapshot and price basis", async () => {
  const catalog = await readFile(resolve(root, "app/data/site-data.ts"), "utf8");
  const snapshot = [...catalog.matchAll(/\["(2026-(?:08|09|10)-\d{2})", (\d+), (\d+), (\d+)\]/g)].map((match) => ({
    date: match[1],
    availableUnits: Number(match[2]),
    nightlyPrice: Number(match[3]),
    minimumNights: Number(match[4]),
  }));

  assert.equal(snapshot.length, 62);
  assert.deepEqual(snapshot[0], { date: "2026-08-14", availableUnits: 0, nightlyPrice: 1200, minimumNights: 1 });
  assert.deepEqual(snapshot.at(-1), { date: "2026-10-14", availableUnits: 4, nightlyPrice: 850, minimumNights: 1 });
  assert.deepEqual(snapshot.find((day) => day.date === "2026-08-19"), { date: "2026-08-19", availableUnits: 4, nightlyPrice: 1200, minimumNights: 2 });
  assert.deepEqual(snapshot.find((day) => day.date === "2026-09-05"), { date: "2026-09-05", availableUnits: 4, nightlyPrice: 850, minimumNights: 1 });
  assert.equal(snapshot.filter((day) => day.availableUnits === 0).length, 10);
  assert.deepEqual([...new Set(snapshot.map((day) => day.nightlyPrice))].sort((a, b) => a - b), [850, 1200]);
  assert.match(catalog, /includedGuests: 2/);
  assert.match(catalog, /minimumNights,/);
});

test("Hilat HaNof search and booking flow enforce source minimum stays and trusted prices", async () => {
  const card = await readFile(resolve(root, "app/components/property-card.tsx"), "utf8");
  const bookingHub = await readFile(resolve(root, "app/components/vacation-booking-hub.tsx"), "utf8");

  assert.match(card, /selectedDays\.length >= minimumNights/);
  assert.match(card, /minimumNights,/);
  assert.match(card, /prices\.every\(\(price\) => price === prices\[0\]\)/);
  assert.match(card, /if \(property\.dailyAvailability\?\.length \|\| property\.dateQuotes\?\.length\) return null/);
  assert.match(bookingHub, /availability\?\.nightlyPrice \|\| \(illustrative \|\| property\.demoOperations\?\.fictional \? suppliedPrice : 0\)/);
  assert.match(bookingHub, /nights < availability\.minimumNights/);
  assert.match(bookingHub, /נדרשים לפחות/);
});

test("Hilat HaNof resolves exact legacy range prices in search and business details", async () => {
  const route = await readFile(resolve(root, "app/api/legacy-availability/route.ts"), "utf8");
  const hook = await readFile(resolve(root, "app/components/use-legacy-availability.ts"), "utf8");
  const card = await readFile(resolve(root, "app/components/property-card.tsx"), "utf8");
  const business = await readFile(resolve(root, "app/business/client-page.tsx"), "utf8");
  assert.match(route, /legacyAvailabilitySourceFor\(place\)/);
  assert.match(sources, /"hilat-hanof"[\s\S]*https:\/\/www\.vii\.co\.il\/hilat_hanof/);
  assert.match(route, /https:\/\/www\.vii\.co\.il\/ajax_order\.php/);
  assert.match(route, /act: "roomList"/);
  assert.match(route, /sid: source\.siteId/);
  assert.match(route, /from: selectedFrom/);
  assert.match(route, /till: selectedTill/);
  assert.match(route, /method: "POST"/);
  assert.match(route, /data-available/);
  assert.match(route, /availableUnits/);
  assert.match(route, /totalPrice/);
  assert.match(route, /units: availableByUnit\.map/);
  assert.match(route, /availability: availableCount > 0 && \(!roomMatches\[index\]\.maxGuests \|\| guests <= roomMatches\[index\]\.maxGuests\) \? "available" : "unavailable"/);
  assert.match(route, /nightlyPrice: prices\[index\] > 0 \? prices\[index\] \/ nights : 0/);
  assert.match(hook, /api\/legacy-availability/);
  assert.match(hook, /legacyAvailabilitySourceFor\(slug\)/);
  assert.match(hook, /units: \(Array\.isArray\(result\.units\) \? result\.units : \[\]\)\.map/);
  assert.match(card, /liveLegacyAvailability \|\| resolveAvailabilityForStay/);
  assert.match(business, /liveLegacyAvailability \|\| resolveAvailabilityForStay/);
  assert.match(business, /roomAvailability = resolvedAvailability\?\.units\?\.find/);
  assert.match(business, /roomBookingHref\(bookingQuery, roomIndex, roomNightlyPrice\)/);
  assert.match(card, /allUnitsAvailable/);
  assert.match(card, /units: property\.roomOptions\.map/);
});

test("business stay dates localize after hydration without Hebrew leaking into foreign pages", async () => {
  const business = await readFile(resolve(root, "app/business/client-page.tsx"), "utf8");
  assert.match(business, /function formatInitialStay\(from: string \| undefined, till: string \| undefined, language: SiteLanguage\)/);
  assert.match(business, /const separator: Record<SiteLanguage, string> = \{ he: " עד ", en: " to ", ru: " – ", fr: " au " \}/);
  assert.match(business, /const \[dates, setDates\] = useState\(initialDates \|\| ""\)/);
  assert.match(business, /const displayDates = dates \|\| formatInitialStay\(initialFrom, initialTill, language\)/);
  assert.doesNotMatch(business, /formatInitialStay\(initialFrom, initialTill\)\)/);
});

test("Hilat HaNof keeps the complete verified legacy gallery locally", async () => {
  const media = await readdir(resolve(root, "public/media/hilat-hanof"));
  assert.equal(media.length, 46);
  assert.ok(media.every((file) => /\.(?:jpg|jpeg)$/i.test(file)));
  assert.ok(media.includes("87686399e3d2342.jpg"));
  assert.ok(media.includes("535f7c268ed1dc4.jpeg"));
  assert.ok(media.includes("105f7c26ece1d6d.jpeg"));
  assert.ok(media.includes("47686399e3e350c.jpg"));
});
