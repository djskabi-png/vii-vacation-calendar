import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("sharing uses one branded accessible dialog instead of the operating system sheet", async () => {
  const [dialog, business, events, article, css] = await Promise.all([
    read("app/components/share-dialog.tsx"),
    read("app/business/client-page.tsx"),
    read("app/events/place/client-page.tsx"),
    read("app/guides/article/client-page.tsx"),
    read("app/globals.css"),
  ]);

  assert.doesNotMatch(`${business}\n${events}\n${article}`, /navigator\.share/);
  assert.match(business, /<ShareButton title=\{property\.name\}/);
  assert.match(events, /<ShareButton title=\{place\.name\} kind="event"/);
  assert.match(article, /<ShareButton title=\{article\.title\} kind="article"/);
  assert.match(dialog, /createPortal/);
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /triggerRef\.current\?\.focus/);
  assert.match(dialog, /navigator\.clipboard\.writeText/);
  assert.match(dialog, /cleanShareUrl/);
  assert.match(dialog, /if \(id\) essential\.set\("id", id\)/);
  assert.match(dialog, /current\.hash = ""/);
  assert.match(dialog, /מצאתי ב־VII מקום שיכול להתאים לנו/);
  assert.doesNotMatch(dialog, /<bdi>/);
  assert.match(dialog, /https:\/\/wa\.me\/\?text=/);
  assert.match(dialog, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(dialog, /mailto:\?subject=/);
  assert.match(dialog, /const copy: Record<SiteLanguage, ShareCopy>/);
  assert.match(css, /\.share-dialog-layer \{ position: fixed; z-index: 2100/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.share-dialog-layer \{ align-items: end/);
  assert.match(css, /font-family: var\(--font-sans\)/);
});

test("shared share trigger is icon-only but retains a localized accessible name", async () => {
  const [dialog, css] = await Promise.all([read("app/components/share-dialog.tsx"), read("app/globals.css")]);
  const trigger = dialog.match(/<button ref=\{triggerRef\}[\s\S]*?<\/button>/)?.[0];
  assert.ok(trigger);
  assert.match(trigger, /aria-label=\{labels\.trigger\}/);
  assert.match(trigger, /title=\{labels\.trigger\}/);
  assert.match(trigger, /aria-haspopup="dialog" aria-expanded=\{open\}/);
  assert.match(trigger, /onClick=\{show\}><ShareIcon \/><\/button>$/);
  assert.doesNotMatch(trigger, /<span|>\{labels\.trigger\}</);
  for (const label of ["שיתוף", "Share", "Поделиться", "Partager"]) assert.ok(dialog.includes(`trigger: "${label}"`));
  assert.match(css, /\.share-trigger \{ width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0/);
  assert.match(css, /\.share-trigger svg \{[^}]*flex: 0 0 18px/);
});

test("sharing previews the actual entity cover, without the failing optimizer, and recovers from missing media", async () => {
  const [dialog, business, events, article, css] = await Promise.all([
    read("app/components/share-dialog.tsx"), read("app/business/client-page.tsx"),
    read("app/events/place/client-page.tsx"), read("app/guides/article/client-page.tsx"), read("app/globals.css"),
  ]);
  assert.match(business, /<ShareButton title=\{property\.name\} image=\{property\.image\}/);
  assert.match(events, /<ShareButton title=\{place\.name\} kind="event" image=\{place\.image\}/);
  assert.match(article, /kind="article" image=\{article\.image\} imageAlt=\{article\.imageAlt\} imageCaption=/);
  assert.match(article, /imageKind === "illustration"/);
  assert.match(dialog, /src=\{image!\}[\s\S]*?unoptimized[\s\S]*?onError=\{\(\) => setPhotoFailed\(true\)\}/);
  assert.match(dialog, /src="\/vii-logo\.png"[^>]*unoptimized[^>]*onError=\{\(\) => setLogoFailed\(true\)\}/);
  assert.match(dialog, /logoFailed \? <span aria-label="VII">VII<\/span>/);
  assert.match(dialog, /<SharePreviewImage key=\{image\}/);
  assert.match(css, /\.share-dialog__preview > \.share-dialog__logo img \{ object-fit: contain; \}/);
  assert.match(css, /\.share-dialog__preview strong \{[^}]*-webkit-line-clamp: 2/);
  assert.ok(events.indexOf('ownerWhatsapp ? <WhatsAppLeadButton') < events.indexOf('<ShareButton title={place.name}'));
});

test("event-specific mobile stylesheet keeps share outside the contact pair and handles absent WhatsApp", async () => {
  const css = await read("app/mobile-polish.css");
  assert.match(css, /\.event-title \.property-title__actions--contact:has\(\.property-whatsapp-action\) \{ grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.2fr\) 44px;/);
  assert.match(css, /:has\(\.property-whatsapp-action\) > \.share-trigger \{ grid-column:3;/);
  assert.match(css, /\.event-title \.property-title__actions--contact > \.property-whatsapp-action \{ grid-column:2;/);
  assert.match(css, /:not\(:has\(\.property-whatsapp-action\)\) \{ grid-template-columns:minmax\(0,1fr\) 44px;/);
  assert.match(css, /> \.property-phone-action \{ grid-column:1; min-width:0;/);
  assert.match(css, /:is\(\.property-phone-action,\.property-whatsapp-action\) > span \{[^}]*white-space:normal;[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.property-phone-action--revealed > span \{ white-space:nowrap/);
});
