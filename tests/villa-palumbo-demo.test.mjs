import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Villa Palumbo is explicitly fictional and has complete demo operations", async () => {
  const data = await read("app/data/site-data.ts");
  assert.match(data, /slug: "villa-palumbo-demo"/);
  assert.match(data, /indexable: false/);
  assert.match(data, /fictional: true/);
  assert.match(data, /ownerEmail: "adir@wplus\.co\.il"/);
  assert.match(data, /availabilityPattern: "two-open-two-busy"/);
  assert.match(data, /weekdayNightlyPrice: 2400/);
  assert.match(data, /weekendNightlyPrice: 3200/);
  assert.match(data, /תמונות המחשה שנוצרו בבינה מלאכותית/);
  assert.match(data, /אין להגיע לכתובת/);
  const demoBlock = data.slice(data.indexOf('slug: "villa-palumbo-demo"'), data.indexOf('slug: "aqua-resort"'));
  assert.doesNotMatch(demoBlock, /phone:/);
  assert.doesNotMatch(demoBlock, /whatsapp:/);
});

test("fictional booking is forced into a non-sending preview flow", async () => {
  const page = await read("app/booking/page.tsx");
  const client = await read("app/booking/client-page.tsx");
  assert.match(page, /params\.illustrative === "1" \|\| property\.demoOperations\?\.fictional === true/);
  assert.match(client, /if \(props\.illustrative\) \{ setReference\(demoReference\); setState\("success"\); return; \}/);
  assert.match(client, /מה הלקוח ובעל המקום היו מקבלים/);
  assert.match(client, /ההודעות הבאות לא נשלחו/);
  assert.match(client, /props\.demoOwnerEmail \|\| "adir@wplus\.co\.il"/);
  assert.equal((client.match(/<em>לא נשלח<\/em>/g) || []).length, 6);
});

test("fictional property is excluded from lodging structured data and indexing", async () => {
  const page = await read("app/business/page.tsx");
  assert.match(page, /robots: property\.demoOperations\?\.fictional \? \{ index: false, follow: false \}/);
  assert.match(page, /!property\.demoOperations\?\.fictional \? <StructuredData data=\{lodgingSchema\(property\)\}/);
});

test("Villa Palumbo images are local generated assets", async () => {
  const data = await read("app/data/site-data.ts");
  for (const file of ["exterior.webp", "living-room.webp", "master-bedroom.webp", "outdoor-dining.webp"]) {
    assert.match(data, new RegExp(`/media/villa-palumbo-demo/${file.replace(".", "\\.")}`));
  }
});

test("Villa Palumbo is the complete fictional depth-page model", async () => {
  const data = await read("app/data/site-data.ts");
  const business = await read("app/business/client-page.tsx");
  const gallery = await read("app/components/gallery-experience.tsx");
  const block = data.slice(data.indexOf('slug: "villa-palumbo-demo"'), data.indexOf('slug: "aqua-resort"'));
  assert.ok((block.match(/\/media\/villa-palumbo-demo\/[a-z-]+\.webp/g) || []).length >= 10);
  assert.match(block, /videos: \[\{/);
  assert.match(block, /tour\.mp4/);
  assert.equal((block.match(/name: "(?:חדר הורים|חדר שינה [234])"/g) || []).length, 4);
  assert.match(block, /guestPhotos: \[/);
  assert.equal((block.match(/illustrative: true/g) || []).length, 2);
  assert.match(block, /reviewSource: "fictional-demo"/);
  assert.ok((block.match(/דוגמה בדיונית/g) || []).length >= 4);
  assert.match(business, /palumbo-media-story/);
  assert.match(business, /מידע מעשי לדוגמה/);
  assert.match(gallery, /property\.guestPhotos/);
});
