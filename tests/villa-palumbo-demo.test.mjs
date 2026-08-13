import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Villa Palumbo remains a safe, complete illustrative listing", async () => {
  const data = await read("app/data/site-data.ts");
  const block = data.slice(data.indexOf('slug: "villa-palumbo-demo"'), data.indexOf('slug: "aqua-resort"'));
  assert.match(block, /indexable: false/);
  assert.match(block, /fictional: true/);
  assert.match(block, /ownerEmail: "adir@wplus\.co\.il"/);
  assert.match(block, /availabilityPattern: "two-open-two-busy"/);
  assert.match(block, /weekdayNightlyPrice: 2400/);
  assert.match(block, /weekendNightlyPrice: 3200/);
  assert.match(block, /disclosure: "מתחם בדיקה בדיוני/);
  assert.doesNotMatch(block, /phone:/);
  assert.doesNotMatch(block, /whatsapp:/);
});

test("fictional booking is forced into a non-sending preview flow", async () => {
  const page = await read("app/booking/page.tsx");
  const client = await read("app/booking/client-page.tsx");
  assert.match(page, /params\.illustrative === "1" \|\| property\.demoOperations\?\.fictional === true/);
  assert.match(client, /if \(props\.illustrative\) \{ setReference\(demoReference\); setState\("success"\); return; \}/);
  assert.match(client, /ההודעות הבאות לא נשלחו/);
  assert.match(client, /props\.demoOwnerEmail \|\| "adir@wplus\.co\.il"/);
});

test("fictional property is excluded from indexing and structured data", async () => {
  const page = await read("app/business/page.tsx");
  assert.match(page, /robots: property\.demoOperations\?\.fictional \? \{ index: false, follow: false \}/);
  assert.match(page, /!property\.demoOperations\?\.fictional \? <StructuredData data=\{lodgingSchema\(property\)\}/);
});

test("Villa Palumbo uses local generated media and a complete depth model", async () => {
  const data = await read("app/data/site-data.ts");
  const block = data.slice(data.indexOf('slug: "villa-palumbo-demo"'), data.indexOf('slug: "aqua-resort"'));
  for (const file of ["exterior.webp", "living-room.webp", "master-bedroom.webp", "outdoor-dining.webp"]) assert.match(block, new RegExp(`/media/villa-palumbo-demo/${file.replace(".", "\\.")}`));
  assert.ok((block.match(/\/media\/villa-palumbo-demo\/[a-z-]+\.webp/g) || []).length >= 10);
  assert.match(block, /tour\.mp4/);
  assert.match(block, /guestPhotos: \[/);
  assert.match(block, /reviewSource: "fictional-demo"/);
});

test("Villa Palumbo presents like a normal listing with one restrained disclosure", async () => {
  const business = await read("app/business/client-page.tsx");
  const card = await read("app/components/property-card.tsx");
  const contact = await read("app/components/listing-contact-preview.tsx");
  assert.match(business, /SampleListingDisclosure/);
  assert.match(business, /מידע מעשי/);
  assert.doesNotMatch(business, /fictional-property-notice/);
  assert.match(card, /ListingContactPreview/);
  assert.match(card, /SampleListingDisclosure variant="card"/);
  assert.match(contact, /sample-listing-disclosure/);
  assert.match(contact, /לא נשמרו פרטים ולא נשלחה הודעה/);
  assert.doesNotMatch(contact, /fetch\(/);
  assert.doesNotMatch(contact, /wa\.me/);
});
