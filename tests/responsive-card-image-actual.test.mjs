import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const qa = resolve(".qa-output");
mkdirSync(qa, { recursive: true });
const dir = mkdtempSync(join(qa, "responsive-card-image-actual-"));
const entry = join(dir, "entry.ts");
const bundle = join(dir, "entry.mjs");
writeFileSync(entry, "export{ResponsiveCardImage}from'../../app/components/responsive-card-image.tsx';");
await createRequire(import.meta.resolve("vite"))("esbuild").build({
  entryPoints: [entry], outfile: bundle, bundle: true, format: "esm", platform: "node", packages: "external", logLevel: "silent",
});
const { ResponsiveCardImage } = await import(pathToFileURL(bundle).href);
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("an optimized image that failed before hydration recovers to the original exactly once", async () => {
  const page = new JSDOM('<div id="root"></div>', { url: "https://vii.spaplus.co/" });
  const before = new Map();
  for (const [key, value] of Object.entries({
    window: page.window, document: page.window.document, HTMLElement: page.window.HTMLElement,
    HTMLImageElement: page.window.HTMLImageElement, Node: page.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    before.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById("root"));
  const source = "/api/vii/media/986936d36fde3db.JPG";
  let originalFailures = 0;
  try {
    Object.defineProperty(page.window.HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
    Object.defineProperty(page.window.HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() { return this.getAttribute("src")?.startsWith("/_vinext/image") ? 0 : 900; },
    });
    await act(async () => root.render(React.createElement(ResponsiveCardImage, {
      src: source, alt: "סוויטת נסיה בוטיק", onOriginalFailure: () => originalFailures++,
    })));
    const image = document.querySelector("img");
    assert.equal(image.getAttribute("src"), source);
    assert.equal(image.getAttribute("srcset"), null);
    assert.equal(originalFailures, 0);
    await act(async () => image.dispatchEvent(new page.window.Event("error")));
    assert.equal(originalFailures, 1);
  } finally {
    await act(async () => root.unmount());
    page.window.close();
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("responsive image URLs stay on the VII origin so mobile privacy layers cannot block a second host", async () => {
  const source = "/api/vii/media/661b0895b65730.jpeg";
  const { responsiveCardMedia } = await import("../app/lib/responsive-media.ts");
  const media = responsiveCardMedia(source);
  for (const candidate of [media.src, ...(media.srcSet || "").split(",").map(value => value.trim().split(" ")[0])]) {
    assert.equal(new URL(candidate, "https://vii.spaplus.co").origin, "https://vii.spaplus.co");
  }
});
