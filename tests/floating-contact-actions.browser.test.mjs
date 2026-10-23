import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const proofDir = process.env.VII_VISUAL_PROOF_DIR;
const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  chromium.executablePath(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && fs.existsSync(candidate));

const markup = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>${globals}</style></head>
<body><main style="min-height:1200px;background:#f6fbfa"></main><div class="floating-contact-actions" role="group" aria-label="יצירת קשר עם מקום לדוגמה">
<a class="direct-phone-link" href="tel:0551234567"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"/></svg><bdi dir="ltr">055-1234567</bdi></a>
<button class="floating-contact-actions__whatsapp"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg><span>פנייה בוואטסאפ</span></button>
</div></body></html>`;

async function inspectAt(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.setContent(markup, { waitUntil: "domcontentloaded" });
  return page.locator(".floating-contact-actions").evaluate((dock) => {
    const rect = dock.getBoundingClientRect();
    const actions = [...dock.children].map((child) => {
      const childRect = child.getBoundingClientRect();
      return { width: childRect.width, height: childRect.height, left: childRect.left, right: childRect.right, fontFamily: getComputedStyle(child).fontFamily };
    });
    return {
      display: getComputedStyle(dock).display,
      width: rect.width,
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actions,
    };
  });
}

test("floating phone and WhatsApp dock is hidden on desktop and polished at mobile widths", async (t) => {
  if (!browserExecutable) return t.skip("No Chromium-family browser is available for rendered CSS verification");
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  const page = await browser.newPage();
  try {
    const desktop = await inspectAt(page, 768);
    assert.equal(desktop.display, "none");

    for (const width of [767, 390, 320]) {
      const mobile = await inspectAt(page, width);
      assert.equal(mobile.display, "grid");
      assert.equal(mobile.scrollWidth, mobile.viewport);
      assert.ok(mobile.left >= 11 && mobile.right <= width - 11);
      assert.ok(Math.abs((mobile.left + mobile.right) / 2 - width / 2) < 1);
      assert.equal(mobile.actions.length, 2);
      assert.ok(mobile.actions.every((action) => action.height >= 54));
      assert.ok(Math.abs(mobile.actions[0].width - mobile.actions[1].width) < 1);
      assert.ok(mobile.actions.every((action) => /Rubik|Heebo|Assistant/.test(action.fontFamily)));
    }

    await inspectAt(page, 390);
    await page.locator(".floating-contact-actions__whatsapp").evaluate((action) => action.remove());
    const singleAction = await page.locator(".floating-contact-actions").evaluate((dock) => ({
      dock: dock.getBoundingClientRect().width,
      action: dock.firstElementChild?.getBoundingClientRect().width ?? 0,
    }));
    assert.ok(singleAction.action >= singleAction.dock - 18);

    await page.locator("body").evaluate((body) => body.insertAdjacentHTML("beforeend", '<div class="whatsapp-lead-layer"></div>'));
    assert.equal(await page.locator(".floating-contact-actions").evaluate((dock) => getComputedStyle(dock).display), "none");
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await page.locator(".floating-contact-actions").evaluate((dock) => getComputedStyle(dock).display), "none");
    const returnedMobile = await inspectAt(page, 390);
    assert.equal(returnedMobile.display, "grid");

    if (proofDir) {
      fs.mkdirSync(proofDir, { recursive: true });
      for (const width of [390, 320]) {
        await inspectAt(page, width);
        await page.screenshot({ path: path.join(proofDir, `floating-contact-actions-${width}.png`), fullPage: false });
      }
    }
  } finally {
    await browser.close();
  }
});
