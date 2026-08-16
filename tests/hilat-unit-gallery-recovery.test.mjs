import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("vacation date launcher sits immediately above the verified unit inventory", async () => {
  const business = await read("app/business/client-page.tsx");
  const about = business.indexOf('<section id="about"');
  const hub = business.indexOf('<VacationBookingHub', about);
  const rooms = business.indexOf('<section id="rooms"', hub);
  assert.ok(about >= 0 && hub > about && rooms > hub);
  assert.equal(business.indexOf('<VacationBookingHub', 0), hub);
  assert.doesNotMatch(business, /כל כרטיס מייצג יחידת אירוח נפרדת/);
});

test("vacation details expose direct phone and WhatsApp actions", async () => {
  const business = await read("app/business/client-page.tsx");
  assert.match(business, /phoneHref \? phoneRevealed/);
  assert.match(business, />הצגת מספר<\/button>/);
  assert.match(business, /<a className="property-phone-action property-phone-action--revealed" href=\{phoneHref\}/);
  assert.match(business, /ownerWhatsapp \? <WhatsAppLeadButton world=\{activeWorld\}/);
});

test("Hilat Hanof has four detailed unit galleries and full-detail controls", async () => {
  const [data, business, dialog] = await Promise.all([
    read("app/data/site-data.ts"),
    read("app/business/client-page.tsx"),
    read("app/components/unit-details-dialog.tsx"),
  ]);
  const hilat = data.slice(data.indexOf('slug: "hilat-hanof"'), data.indexOf('slug: "ar-suites"'));
  assert.equal((hilat.match(/name: "בקתה [1-4]"/g) || []).length, 4);
  assert.equal((hilat.match(/images: \["\/media\/hilat-hanof\//g) || []).length, 4);
  assert.equal((hilat.match(/featureGroups:/g) || []).length, 5);
  assert.match(business, /כל פרטי היחידה \+/);
  assert.match(business, /openGallery\("units", unitGalleryStart\)/);
  assert.match(dialog, /לכל תמונות היחידה/);
  assert.match(dialog, /aria-modal="true"/);
});

test("mobile gallery is a topic tour that opens a focused full-image viewer", async () => {
  const [gallery, css] = await Promise.all([
    read("app/components/gallery-experience.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(gallery, /story-gallery__mobile-tour/);
  assert.match(gallery, /mobileGroups\.map/);
  assert.match(gallery, /setMobileViewer\(true\)/);
  assert.match(gallery, /חזרה לכל התמונות/);
  assert.match(css, /\.story-gallery__mobile-tour section > div \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.story-gallery__mobile-stage\.is-viewer \{ display: grid; \}/);
});
