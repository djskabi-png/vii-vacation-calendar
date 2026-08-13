import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const providers = [
  { id: "hagit-designed-events", images: ["hagit-designed-events-1.jpg", "hagit-designed-events-2.jpg", "hagit-designed-events-3.jpg"] },
  { id: "aae-event-design", images: ["aae-event-design-1.jpg", "aae-event-design-2.jpg", "aae-event-design-3.jpg"] },
  { id: "argaman-events", images: ["argaman-events-1.webp", "argaman-events-2.webp", "argaman-events-3.webp"] },
];

test("new verified provider profiles have full content, official sources and three local images", async () => {
  const catalog = await readFile(resolve(root, "app/data/world-data.ts"), "utf8");
  const details = await readFile(resolve(root, "app/data/provider-details.ts"), "utf8");

  for (const provider of providers) {
    assert.match(catalog, new RegExp(`id: "${provider.id}"[\\s\\S]{0,1800}sourceUrl: "https://`));
    assert.match(catalog, new RegExp(`id: "${provider.id}"[\\s\\S]{0,1800}indexable: true`));
    assert.match(details, new RegExp(`"${provider.id}": \\{[\\s\\S]{0,5000}bookingMode: "whatsapp"`));
    assert.match(details, new RegExp(`"${provider.id}": \\{[\\s\\S]{0,5000}services: \\[[\\s\\S]{0,5000}faq: \\[`));

    for (const image of provider.images) {
      const info = await stat(resolve(root, "public/media/providers", image));
      assert.ok(info.size > 20_000, `${image} should be a real local image, not an empty placeholder`);
    }
  }
});

test("new provider profiles never invent aggregate ratings", async () => {
  const catalog = await readFile(resolve(root, "app/data/world-data.ts"), "utf8");
  for (const provider of providers) {
    const entry = catalog.match(new RegExp(`\\{ id: "${provider.id}"[^\\n]+`))?.[0] || "";
    assert.ok(entry);
    assert.doesNotMatch(entry, /rating:/);
  }
});
