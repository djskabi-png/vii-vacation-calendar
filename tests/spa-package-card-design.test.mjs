import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("spa package cards keep supplier facts and expose a clear booking hierarchy", async () => {
  const page = await read("app/discover/place/client-page.tsx");
  assert.match(page, /spa-package-card__media/);
  assert.match(page, /spa-package-card__badges/);
  assert.match(page, /spa-package-card__body/);
  assert.match(page, /spa-package-card__price/);
  assert.match(page, /const \[imageFailed,setImageFailed\] = useState\(false\)/);
  assert.match(page, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.match(page, /translate\("מחיר החבילה"\)/);
  assert.match(page, /href=\{pack\.bookingUrl\}/);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /pack\.includes\.map/);
  assert.match(page, /בחרו את החבילה שמתאימה לכם ובדקו מועד פנוי לפני ההזמנה/);
});

test("spa package cards remain readable at desktop and mobile widths", async () => {
  const css = await read("app/globals.css");
  const previewCss = await read("app/preview-card-consistency.css");
  assert.match(css, /\.spa-packages-grid \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.spa-package-card \{[^}]*overflow: hidden/);
  assert.match(css, /\.spa-package-card__media \{[^}]*aspect-ratio: 16 \/ 9/);
  assert.match(css, /\.spa-package-card h3 \{[^}]*max-height: none;[^}]*overflow: visible;[^}]*overflow-wrap: anywhere;[^}]*-webkit-line-clamp: unset/);
  assert.match(css, /\.spa-package-card footer \{[^}]*grid-template-columns: auto minmax\(0,1fr\)/);
  assert.match(css, /\.spa-package-card footer \{ grid-template-columns: 1fr;/);
  assert.match(previewCss, /\.spa-package-card \.spa-package-card__body > h3 \{[^}]*min-block-size: 0;[^}]*max-block-size: none;[^}]*overflow: visible;[^}]*display: block;[^}]*-webkit-line-clamp: unset/);
});
