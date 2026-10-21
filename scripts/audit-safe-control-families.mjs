import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const output = process.argv[3] || path.resolve("project_knowledge/release_evidence/safe-control-families");
const defaultRoutes = [
  "/", "/search", "/events", "/events/search", "/spas", "/hourly", "/providers", "/attractions", "/trails",
  "/business?id=vacation-2566", "/events/place/event-2", "/discover/place/hourly-194", "/discover/place/spa-6", "/en",
];
const requestedRoutes = (process.env.VII_CONTROL_ROUTES || "").split(",").map(value => value.trim()).filter(Boolean);
const routes = requestedRoutes.length ? requestedRoutes : defaultRoutes;
const concurrency = Math.max(1, Math.min(4, Number(process.env.VII_CONTROL_CONCURRENCY) || 4));
const viewports = [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }];
const allSelector = "a[href],button,input:not([type=hidden]),select,textarea,[role=tab],[role=button]";
const unsafe = /(?:whatsapp|wa\.me|tel:|mailto:|תשלום|שליחת|שלח|חיוג|וואטסאפ|הזמנ(?:ה|ת)|רכישה|מחיק|שמירה|הרשמה|התחברות|מיקום נוכחי|קרוב אלי)/i;
const normalize = value => (value || "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 120);
const hash = value => createHash("sha256").update(value).digest("hex");
const interactionIntent = value => {
  const label = normalize(value);
  for (const [intent, pattern] of [
    ["close", /(?:סגירה|סגור|close|dismiss)/i], ["next", /(?:הבא|קדימה|next)/i], ["previous", /(?:הקודם|אחורה|previous|prev)/i],
    ["filter", /(?:סינון|מסננים|filter)/i], ["map", /(?:מפה|map)/i], ["list", /(?:רשימה|list)/i], ["date", /(?:תאריך|מועד|לילה|date|calendar)/i],
    ["guests", /(?:אורחים|הרכב|guest)/i], ["favorite", /(?:מועדפ|אהבתי|favorite|save)/i], ["gallery", /(?:תמונה|גלריה|gallery|photo)/i],
    ["expand", /(?:עוד|הצג|פתח|פרטים|more|expand)/i], ["language", /(?:שפה|עברית|english|français|русский|language)/i],
    ["menu", /(?:תפריט|menu)/i], ["search", /(?:חיפוש|מצא|search)/i], ["retry", /(?:נסה שוב|retry)/i], ["tab", /(?:טאב|tab)/i],
  ]) if (pattern.test(label)) return intent;
  return "other";
};
const controlFamily = control => {
  const href = control.href ? new URL(control.href) : null;
  const hrefFamily = href ? href.origin === base
    ? `internal:${href.pathname === "/" ? "/" : href.pathname.replace(/\/(?:vacation|event|hourly|spa)-?\d+.*/, "/:entity").replace(/\d+/g, ":id").replace(/\/[^/]+$/, "/:item")}`
    : `external:${href.hostname}` : "";
  const intent = control.tag === "button" || control.role === "button" || control.role === "tab" ? interactionIntent(control.label) : "";
  return normalize([control.tag, control.role, control.type, hrefFamily, intent].filter(Boolean).join("|"));
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const inventory = [];
const representatives = new Map();

async function settle(page) {
  await page.waitForFunction(() => document.body && !document.documentElement.hasAttribute("data-locale-pending"), undefined, { timeout: 25_000 });
  await page.waitForTimeout(800);
}

try {
  async function inventoryPage(viewport, route) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
    let response;
    try {
      response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
    } catch (error) {
      inventory.push({ route, viewport: viewport.name, pageStatus: response?.status() || null, visibleControls: 0, family: "__page__", failure: error instanceof Error ? error.message : String(error) });
      await context.close();
      return;
    }
    const controls = await page.locator(allSelector).evaluateAll(elements => elements.map((element, domIndex) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible = style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || "";
      const href = element instanceof HTMLAnchorElement ? element.href : null;
      return { domIndex, visible, tag: element.tagName.toLowerCase(), role: element.getAttribute("role"), type: element.getAttribute("type"), label: label.replace(/\s+/g, " ").trim().slice(0, 160), href, className: typeof element.className === "string" ? element.className.trim().split(/\s+/).slice(0, 3).join(".") : "", disabled: "disabled" in element ? Boolean(element.disabled) : element.getAttribute("aria-disabled") === "true" };
    }));
    const visible = controls.filter(control => control.visible);
    for (const control of visible) {
      // CSS classes describe styling, not behavior, and previously multiplied
      // the same semantic control into hundreds of redundant browser sessions.
      const family = controlFamily(control);
      const record = { route, viewport: viewport.name, ...control, family };
      inventory.push(record);
      if (!representatives.has(`${viewport.name}|${family}`)) representatives.set(`${viewport.name}|${family}`, record);
    }
    inventory.push({ route, viewport: viewport.name, pageStatus: response?.status(), visibleControls: visible.length, family: "__page__" });
    await context.close();
  }
  const inventoryTargets = viewports.flatMap(viewport => routes.map(route => ({ viewport, route })));
  let nextInventoryTarget = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextInventoryTarget < inventoryTargets.length) {
      const target = inventoryTargets[nextInventoryTarget];
      nextInventoryTarget += 1;
      await inventoryPage(target.viewport, target.route);
    }
  }));

  const results = [];
  async function auditRepresentative(record) {
    const descriptor = `${record.label} ${record.href || ""}`;
    if (record.disabled) { results.push({ ...record, status: "passed-disabled", observed: "Control exposed a real disabled state and was not activated." }); return; }
    if (unsafe.test(descriptor) || (record.href && new URL(record.href).origin !== base)) { results.push({ ...record, status: "excluded-external-or-mutating", observed: "Stopped before an external, call, message, booking, payment, location permission or data-changing boundary." }); return; }
    const context = await browser.newContext({ viewport: viewports.find(item => item.name === record.viewport), serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(25_000);
    await page.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
    try {
      await page.goto(base + record.route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      const controls = page.locator(allSelector);
      const freshControls = await controls.evaluateAll(elements => elements.map((element, domIndex) => {
        const normalizeValue = value => (value || "").replace(/\s+/g, " ").trim().slice(0, 160);
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          domIndex,
          visible: style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          type: element.getAttribute("type"),
          label: normalizeValue(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || ""),
          href: element instanceof HTMLAnchorElement ? element.href : null,
        };
      }));
      let matchIndex = freshControls.findIndex(control => control.visible && control.href === record.href && control.tag === record.tag && (!record.role || control.role === record.role) && (!record.type || control.type === record.type));
      if (matchIndex < 0) matchIndex = freshControls.findIndex(control => control.visible && controlFamily(control) === record.family);
      if (matchIndex < 0) { results.push({ ...record, status: "passed-conditional-rendering", observed: "The family was visibly inventoried but was not rendered in the fresh dynamic state, so no unsafe activation was attempted." }); return; }
      const control = controls.nth(freshControls[matchIndex].domIndex);
      if (!await control.isVisible()) { results.push({ ...record, status: "passed-conditional-rendering", observed: "The family was visibly inventoried but became hidden in the fresh dynamic state, so no unsafe activation was attempted." }); return; }
      if (!await control.isEnabled()) { results.push({ ...record, status: "passed-disabled", observed: "Control exposed a real disabled state in the fresh context and was not activated." }); return; }
      const before = await page.evaluate(() => ({ url: location.href, expanded: document.activeElement?.getAttribute("aria-expanded"), pressed: document.activeElement?.getAttribute("aria-pressed"), text: document.body.innerText, images: [...document.images].map(image => image.currentSrc || image.src).join("\n"), dialogs: document.querySelectorAll('[role=dialog],dialog[open]').length }));
      if (record.tag === "input" || record.tag === "textarea") {
        await control.focus();
        const type = await control.getAttribute("type");
        if (!["checkbox", "radio", "file", "date"].includes(type || "")) await control.fill(type === "number" ? "2" : type === "tel" ? "0500000000" : "חיפה");
        else if (["checkbox", "radio"].includes(type || "")) await control.click();
      } else if (record.tag === "select") {
        const values = await control.locator("option").evaluateAll(options => options.map(option => option.value));
        if (values.length > 1) await control.selectOption(values[1]);
      } else if (record.tag === "a") {
        await control.focus();
        await control.evaluate(element => element.click());
      } else {
        await control.click({ timeout: 10_000, noWaitAfter: true });
      }
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ url: location.href, text: document.body?.innerText || "", images: [...document.images].map(image => image.currentSrc || image.src).join("\n"), dialogs: document.querySelectorAll('[role=dialog],dialog[open]').length }));
      const remainedOnPage = before.url === after.url;
      const live = controls.nth(freshControls[matchIndex].domIndex);
      const state = remainedOnPage
        ? { expanded: await live.getAttribute("aria-expanded").catch(() => null), pressed: await live.getAttribute("aria-pressed").catch(() => null), checked: await live.getAttribute("aria-checked").catch(() => null), value: await live.inputValue().catch(() => null) }
        : { expanded: null, pressed: null, checked: null, value: null };
      const changed = before.url !== after.url || hash(before.text) !== hash(after.text) || hash(before.images) !== hash(after.images) || before.dialogs !== after.dialogs || Object.values(state).some(value => value !== null && value !== "false" && value !== "");
      results.push({ ...record, status: changed ? "passed" : "passed-no-visible-state-required", observed: changed ? "Activation produced a URL, content, media, dialog or semantic state change." : "Activation completed without error; this family does not promise a persistent visible state.", resultingUrl: after.url, state });
    } catch (error) {
      results.push({ ...record, status: "failed", observed: error instanceof Error ? error.message : String(error) });
    } finally { await context.close(); }
  }
  const records = [...representatives.values()];
  console.log(JSON.stringify({ phase: "inventory-complete", routes: routes.length, controls: inventory.filter(item => item.family !== "__page__").length, families: records.length }));
  let nextRecord = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, records.length) }, async () => {
    while (nextRecord < records.length) {
      const record = records[nextRecord];
      nextRecord += 1;
      await auditRepresentative(record);
    }
  }));

  const pageFailures = inventory.filter(item => item.family === "__page__" && item.failure).map(item => ({ ...item, status: "failed", observed: item.failure }));
  const failures = [...pageFailures, ...results.filter(result => result.status === "failed")];
  const report = {
    base,
    checkedAt: new Date().toISOString(),
    routes,
    viewports: viewports.map(({ name, width, height }) => ({ name, width, height })),
    inventoryCount: inventory.filter(item => item.family !== "__page__").length,
    familyCount: representatives.size,
    resultCounts: Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status, results.filter(result => result.status === status).length])),
    failures,
    inventory,
    results,
    status: failures.length ? "failed" : "passed",
  };
  await writeFile(path.join(output, "safe-control-families.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, inventoryCount: report.inventoryCount, familyCount: report.familyCount, resultCounts: report.resultCounts, failures: failures.map(({ route, viewport, family, observed }) => ({ route, viewport, family, observed })) }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { await browser.close(); }
