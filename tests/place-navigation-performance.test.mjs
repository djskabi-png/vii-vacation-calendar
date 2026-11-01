import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("internal business cards keep navigation inside the app", async () => {
  const [properties, events, spas, showcase] = await Promise.all([
    source("app/components/property-card.tsx"),
    source("app/components/event-last-minute.tsx"),
    source("app/components/spa-package-deals.tsx"),
    source("app/components/home-showcase.tsx"),
  ]);
  assert.doesNotMatch(properties, /propertyHref[^\n]*target="_blank"/);
  assert.doesNotMatch(events, /href=\{href\}\s+newTab/);
  assert.doesNotMatch(spas, /spa-deal-card__body[^\n]*target="_blank"/);
  assert.doesNotMatch(showcase, /home-rating-card__gallery[^\n]*target="_blank"/);
});

test("every place-detail route has an immediate shared loading state", async () => {
  const [business, events, discovery, component, styles, progress, layout] = await Promise.all([
    source("app/business/loading.tsx"),
    source("app/events/place/loading.tsx"),
    source("app/discover/place/loading.tsx"),
    source("app/components/place-page-loading.tsx"),
    source("app/components/place-page-loading.css"),
    source("app/components/navigation-progress.tsx"),
    source("app/layout.tsx"),
  ]);
  for (const route of [business, events, discovery]) assert.match(route, /PlacePageLoading/);
  assert.match(component, /aria-busy="true"/);
  assert.match(component, /טוענים את פרטי המקום/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(progress, /document\.addEventListener\("click", start, true\)/);
  assert.match(progress, /navigationProgressReady = "true"/);
  assert.match(progress, /aria-live="polite"/);
  assert.match(layout, /<NavigationProgress \/>/);
});
