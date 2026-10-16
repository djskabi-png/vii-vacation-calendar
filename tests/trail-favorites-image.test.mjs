import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("saved and viewed trail cards use the current image even when a stored snapshot has no image", async () => {
  const page = await read("app/favorites/page.tsx");
  assert.match(page, /item\.world === "trails" \? trailBySlug\.get\(item\.id\)/);
  assert.match(page, /const image = trail \? `\/images\/trails\/\$\{trail\.slug\}\.jpg` : item\.image/);
  assert.match(page, /const items: LibraryItem\[\] = mode === "viewed" \? viewedItems : savedItems/);
  assert.match(page, /<PreviewCardGallery className="favorite-card__media" name=\{imageAlt\} imageLabel=\{imageTitle\}/);
  assert.match(page, /favorite-card__media-label/);
  assert.match(page, /<FavoriteButton id=\{item\.id\} world=\{item\.world\}/);
});

test("all catalog trail covers used by favorites exist", async () => {
  const data = await read("app/data/trail-data.ts");
  const slugs = [...data.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.equal(slugs.length, 48);
  for (const slug of slugs) {
    const asset = fileURLToPath(new URL(`public/images/trails/${slug}.jpg`, root));
    assert.ok((await stat(asset)).size > 1000, slug);
  }
});
