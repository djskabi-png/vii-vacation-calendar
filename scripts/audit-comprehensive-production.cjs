#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { analyzeLocaleSeo, analyzeTextSamples, localizedRoute } = require("./multilingual-qa-rules.cjs");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "comprehensive-production");
mkdirSync(outputDir, { recursive: true });
const report = { schemaVersion: 1, baseUrl, startedAt: new Date().toISOString(), exclusions: ["accessibility", "typography"], cases: [] };
const caseTimeoutMs = Number(process.env.QA_CASE_TIMEOUT_MS || 30_000);

function record(id, surface, viewport, status, evidence, durationMs) {
  report.cases.push({ id, surface, viewport, status, evidence, durationMs });
}

async function observed(id, surface, viewport, fn) {
  const started = Date.now();
  let timeoutId;
  try {
    const evidence = await Promise.race([
      fn(),
      new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error(`case_timeout_${caseTimeoutMs}`)), caseTimeoutMs); }),
    ]);
    record(id, surface, viewport, "passed", evidence || "verified", Date.now() - started);
  } catch (error) {
    record(id, surface, viewport, "failed", error instanceof Error ? error.message : String(error), Date.now() - started);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    const last = report.cases.at(-1);
    process.stdout.write(`${last?.status === "passed" ? "PASS" : "FAIL"} ${id} ${Date.now() - started}ms${last?.status === "failed" ? ` ${last.evidence}` : ""}\n`);
  }
}

async function assertNaturalPage(page, path) {
  let response;
  try { response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 }); }
  catch (error) {
    if (!String(error).includes("ERR_ABORTED") || !await page.locator("main").count()) throw error;
  }
  if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || "no_response"}`);
  await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
  await page.waitForSelector('html[data-vii-hydrated="true"]', { state: "attached", timeout: 20_000 });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  if (/Error 1102|Worker exceeded resource limits|Application error|Internal Server Error/i.test(body)) throw new Error("provider_or_application_error_surface");
  const readMetrics = () => page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, text: (document.body.innerText || "").trim().length }));
  let metrics;
  try {
    metrics = await readMetrics();
  } catch (error) {
    if (!String(error).includes("Execution context was destroyed")) throw error;
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
    await page.waitForTimeout(350);
    metrics = await readMetrics();
  }
  if (metrics.text < 120) throw new Error("insufficient_visible_content");
  if (metrics.width > metrics.client + 1) throw new Error(`horizontal_overflow_${metrics.width}_${metrics.client}`);
  return { status: response.status(), ...metrics };
}

async function verifyImages(page) {
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const visible = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 40 && box.height > 40 && box.bottom > 0 && box.top < innerHeight * 2;
    });
    const broken = visible.filter((image) => image.complete && (image.naturalWidth < 2 || image.naturalHeight < 2)).map((image) => image.currentSrc || image.src);
    if (broken.length) throw new Error(`broken_images:${broken.slice(0, 3).join("|")}`);
    return { visibleImages: visible.length };
  });
}

async function verifyLocaleExperience(page, path, locale) {
  const base = await assertNaturalPage(page, path);
  await page.waitForFunction((expected) => document.documentElement.lang === expected && !document.documentElement.hasAttribute("data-locale-pending"), locale, { timeout: 15_000 });
  await page.waitForTimeout(450);
  const collectLocaleSurface = (expectedLocale) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 2 && rect.height > 2;
    };
    const selector = (element) => {
      if (element.id) return `${element.tagName.toLowerCase()}#${CSS.escape(element.id)}`;
      const classes = [...element.classList].slice(0, 3).map((name) => `.${CSS.escape(name)}`).join("");
      return `${element.tagName.toLowerCase()}${classes}`;
    };
    const textSamples = [];
    for (const element of document.querySelectorAll("body *")) for (const node of element.childNodes) {
      if (node.nodeType !== 3) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim() || "";
      if (text.length < 2 || !visible(element) || element.closest("script,style,noscript,svg,[data-no-translate]")) continue;
      textSamples.push({ selector: selector(element), text: text.slice(0, 220) });
    }

    const insideHorizontalScroller = (element) => {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 4) return true;
      }
      return false;
    };

    const clipped = [...document.querySelectorAll("main h1,main h2,main h3,main button,main [role='tab'],main [role='button']")]
      .filter((element) => visible(element) && !element.closest("[data-horizontal-rail]"))
      .flatMap((element) => {
        const style = getComputedStyle(element);
        const intentionallyTruncated = style.textOverflow === "ellipsis" || Number.parseInt(style.webkitLineClamp || "0", 10) > 0;
        const clipsX = (style.overflowX === "hidden" || style.overflowX === "clip") && element.scrollWidth > element.clientWidth + 2;
        const clipsY = (style.overflowY === "hidden" || style.overflowY === "clip") && element.scrollHeight > element.clientHeight + 2;
        const isClipped = clipsX || clipsY;
        return isClipped && !intentionallyTruncated ? [{ kind: "clipped_text", selector: selector(element), text: (element.textContent || "").trim().slice(0, 160), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }] : [];
      });

    const offscreen = [...document.querySelectorAll("main h1,main h2,main h3,main button,main [role='tab']")]
      .filter((element) => visible(element) && !element.closest("[data-horizontal-rail]") && !insideHorizontalScroller(element))
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -2 || rect.right > innerWidth + 2 ? [{ kind: "offscreen_element", selector: selector(element), text: (element.textContent || "").trim().slice(0, 160), rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } }] : [];
      });

    const headings = [...document.querySelectorAll("main h1,main h2,main h3")].filter(visible);
    const surfaces = [...document.querySelectorAll("main article,main [class*='hero__card'],main [class*='hero-card'],main .gift-hero__card")].filter(visible);
    const collisions = [];
    for (const heading of headings) for (const surface of surfaces) {
      if (heading === surface || heading.contains(surface) || surface.contains(heading)) continue;
      const a = heading.getBoundingClientRect();
      const b = surface.getBoundingClientRect();
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const ratio = width * height / Math.max(1, a.width * a.height);
      if (ratio > 0.06) collisions.push({ kind: "visual_collision", heading: selector(heading), surface: selector(surface), text: (heading.textContent || "").trim().slice(0, 160), ratio: Number(ratio.toFixed(4)), headingRect: { left: a.left, right: a.right, top: a.top, bottom: a.bottom }, surfaceRect: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } });
    }

    const direction = document.documentElement.dir;
    const expectedDirection = expectedLocale === "he" ? "rtl" : "ltr";
    const directionProblems = direction === expectedDirection ? [] : [{ kind: "document_direction", expected: expectedDirection, actual: direction }];
    if (expectedLocale !== "he") {
      for (const element of document.querySelectorAll("main [dir='rtl']")) {
        if (!visible(element) || element.closest("[data-no-translate]")) continue;
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length > 2) directionProblems.push({ kind: "unexpected_rtl_content", selector: selector(element), text: text.slice(0, 160) });
      }
    }

    const sliderProblems = [];
    for (const controls of document.querySelectorAll("[data-slider-controls][aria-controls='home-ratings-rail']")) {
      if (!visible(controls)) continue;
      const railId = controls.getAttribute("aria-controls");
      const rail = railId ? document.getElementById(railId) : null;
      const buttons = controls.querySelectorAll("button");
      if (!rail || buttons.length < 2 || rail.scrollWidth <= rail.clientWidth + 4) continue;
      const expectedRailDirection = expectedLocale === "he" ? "rtl" : "ltr";
      const actualRailDirection = getComputedStyle(rail).direction;
      if (actualRailDirection !== expectedRailDirection || !buttons[0].disabled || buttons[1].disabled) sliderProblems.push({ kind: "initial_slider_boundary", selector: selector(controls), rail: railId, previousDisabled: buttons[0].disabled, nextDisabled: buttons[1].disabled, expectedRailDirection, actualRailDirection });
    }

    const seo = {
      currentUrl: location.href,
      canonical: document.querySelector("link[rel='canonical']")?.href || "",
      ogUrl: document.querySelector("meta[property='og:url']")?.content || "",
      alternates: [...document.querySelectorAll("link[rel='alternate'][hreflang]")].map((link) => ({ hreflang: link.getAttribute("hreflang"), href: link.href })),
    };
    return { root: { lang: document.documentElement.lang, direction }, seo, textSamples, layoutProblems: [...clipped, ...offscreen, ...collisions, ...directionProblems, ...sliderProblems] };
  };
  let observed;
  try {
    observed = await page.evaluate(collectLocaleSurface, locale);
  } catch (error) {
    if (!String(error).includes("Execution context was destroyed")) throw error;
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForFunction((expected) => document.documentElement.lang === expected && !document.documentElement.hasAttribute("data-locale-pending"), locale, { timeout: 15_000 });
    await page.waitForTimeout(350);
    observed = await page.evaluate(collectLocaleSurface, locale);
  }

  const textProblems = analyzeTextSamples(observed.textSamples, locale);
  const seoProblems = analyzeLocaleSeo(observed.seo, locale);
  const problems = [...seoProblems, ...textProblems, ...observed.layoutProblems];
  if (problems.length) throw new Error(`multilingual_visual_integrity:${JSON.stringify({ locale, count: problems.length, problems: problems.slice(0, 12) })}`);
  return { ...base, locale, lang: observed.root.lang, direction: observed.root.direction, visibleTextNodes: observed.textSamples.length };
}

async function verifyLocalizedNavigation(page, locale) {
  if (locale === "he") return { skipped: "canonical Hebrew route" };
  const link = page.locator(".home-magazine a,.home-rating-card__cta").first();
  if (!await link.count()) throw new Error("localized_navigation_candidate_missing");
  await link.click();
  await page.waitForLoadState("domcontentloaded");
  const pathname = new URL(page.url()).pathname;
  if (!(pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))) throw new Error(`locale_lost_after_navigation:${page.url()}`);
  return { url: page.url() };
}

async function runLocaleMatrix(browser, viewport, routeSubset) {
  const requestedLocales = (process.env.QA_LOCALES || "he,en,ru,fr").split(",").map((locale) => locale.trim()).filter(Boolean);
  const locales = requestedLocales.filter((locale) => ["he", "en", "ru", "fr"].includes(locale));
  if (!locales.length) throw new Error("qa_locales_empty_or_invalid");
  const routes = routeSubset || [
    ["home", "/"],
    ["vacation-search", "/search"],
    ["events", "/events"],
    ["hourly", "/hourly"],
    ["spa", "/spas"],
    ["guides", "/guides"],
    ["gift-card", "/gift-card"],
    ["vacation-place", "/business?id=vacation-116"],
    ["event-place", "/events/place/event-2575"],
    ["hourly-place", "/discover/place/hourly-475"],
    ["spa-place", "/discover/place/spa-6"],
  ];
  for (const locale of locales) {
    const context = await browser.newContext({ viewport: viewport.size, locale: locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "fr-FR", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
    for (const [surface, canonicalRoute] of routes) {
      const route = localizedRoute(canonicalRoute, locale);
      const id = `locale-${locale}-${surface}-${viewport.id}`;
      const page = await context.newPage();
      page.on("dialog", (dialog) => dialog.dismiss());
      await observed(id, surface, viewport.id, async () => {
        try {
          const result = await verifyLocaleExperience(page, route, locale);
          return result;
        } catch (error) {
          const screenshot = join(outputDir, `${id}.png`);
          await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
          throw new Error(`${error instanceof Error ? error.message : String(error)};screenshot=${screenshot}`);
        }
      });
      await page.close({ runBeforeUnload: false }).catch(() => undefined);
    }
    if (locale !== "he") {
      const id = `locale-${locale}-navigation-${viewport.id}`;
      const page = await context.newPage();
      await observed(id, "localized navigation", viewport.id, async () => {
        try {
          await assertNaturalPage(page, localizedRoute("/", locale));
          await page.waitForFunction((expected) => document.documentElement.lang === expected && !document.documentElement.hasAttribute("data-locale-pending"), locale, { timeout: 15_000 });
          return await verifyLocalizedNavigation(page, locale);
        } catch (error) {
          const screenshot = join(outputDir, `${id}.png`);
          await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
          throw new Error(`${error instanceof Error ? error.message : String(error)};screenshot=${screenshot}`);
        }
      });
      await page.close({ runBeforeUnload: false }).catch(() => undefined);
    }
    await context.close().catch(() => undefined);
  }
}

async function verifyResultsMap(page) {
  // Results hydrate and progressively replace cards. Scrolling a captured
  // card/region locator races that replacement and creates detached-element
  // failures unrelated to the map. Wait for the stable public control and
  // resolve it again immediately before each action.
  await page.waitForSelector(".mobile-map-fab", { state: "visible", timeout: 20_000 });
  let toggle = page.locator(".mobile-map-fab:visible").first();
  await toggle.hover({ timeout: 10_000 });
  await page.waitForTimeout(350);
  toggle = page.locator(".mobile-map-fab:visible").first();
  await toggle.click({ timeout: 10_000 });
  await page.waitForSelector(".listing-map", { state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll(".leaflet-tile").length > 0, null, { timeout: 20_000 });
  const state = await page.evaluate(() => ({ tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".vii-map-marker").length, selectedCards: document.querySelectorAll(".map-selection-card").length }));
  if (!state.markers) throw new Error("map_markers_missing");
  const clickableBox = (selector) => page.locator(selector).evaluateAll((elements) => {
    const index = elements.findIndex((candidate) => {
      const box = candidate.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) return false;
      const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
      const topmost = document.elementFromPoint(x, y);
      return Boolean(topmost && (topmost === candidate || candidate.contains(topmost)));
    });
    if (index < 0) return null;
    const element = elements[index];
    const box = element.getBoundingClientRect();
    return { index, x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const markerBox = await clickableBox(".vii-map-marker-wrap:not(.is-cluster)");
    if (markerBox) {
      await page.mouse.click(markerBox.x, markerBox.y);
      await page.waitForTimeout(700);
      if (await page.locator(".map-selection-card:visible").count()) break;
    }
    const clusterBox = await clickableBox(".vii-map-marker-wrap.is-cluster");
    if (clusterBox) await page.mouse.click(clusterBox.x, clusterBox.y);
    await page.waitForTimeout(clusterBox ? 900 : 500);
  }
  await page.waitForSelector(".map-selection-card", { state: "visible", timeout: 10_000 });
  state.selectedCards = await page.locator(".map-selection-card").count();
  const close = page.locator(".map-mobile-close:visible").first();
  if (await close.count()) await close.click();
  else await toggle.click();
  return state;
}

async function verifyPlace(page, path, expectations) {
  const base = await assertNaturalPage(page, path);
  const location = page.locator("#location,#event-map").first();
  if (await location.count()) { await location.scrollIntoViewIfNeeded(); await page.waitForTimeout(1_200); }
  if (expectations.map) await page.waitForSelector(".map-preview-card,.listing-map-shell", { state: "attached", timeout: 15_000 });
  const state = await page.evaluate(() => ({
    phone: Boolean(document.querySelector('a[href^="tel:"]')),
    whatsapp: Boolean(document.querySelector('.property-whatsapp-action,[class*="whatsapp"]')),
    galleryTrigger: Boolean(document.querySelector(".property-gallery button")),
    reviewSummary: Boolean(document.querySelector(".detail-mobile-review-summary")),
    mapPreview: Boolean(document.querySelector(".map-preview-card,.listing-map-shell")),
  }));
  if (expectations.phone && !state.phone || expectations.gallery && !state.galleryTrigger || expectations.map && !state.mapPreview) throw new Error(`place_contract:${JSON.stringify(state)}`);
  if (!expectations.gallery || !state.galleryTrigger) return { ...base, ...state, galleryTabs: 0 };
  const gallery = page.locator(".property-gallery button").first();
  await gallery.click({ timeout: 10_000 });
  await page.waitForSelector(".story-gallery", { state: "visible", timeout: 15_000 });
  const tabs = await page.locator(".story-gallery button[aria-pressed]").count();
  if (!tabs) throw new Error("gallery_tabs_missing");
  const close = page.locator(".story-gallery__close").first();
  if (await close.count()) await close.click(); else await page.keyboard.press("Escape");
  return { ...base, ...state, galleryTabs: tabs };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport: viewport.size, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const browserCase = async (id, surface, fn) => {
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss());
    try { await observed(id, surface, viewport.id, () => fn(page)); }
    finally {
      await Promise.race([
        page.close({ runBeforeUnload: false }).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  };

  await browserCase(`privacy-consent-${viewport.id}`, "privacy consent", async (page) => {
    await assertNaturalPage(page, "/");
    const card = page.locator(".cookie-card").first();
    await card.waitFor({ state: "visible", timeout: 5_000 });
    const essentials = card.locator(".cookie-actions .button.subtle").first();
    if (!await essentials.count()) throw new Error("essential_cookie_choice_missing");
    await essentials.click();
    await card.waitFor({ state: "detached", timeout: 5_000 });
    const choice = await page.evaluate(() => localStorage.getItem("vii-cookie-choice"));
    if (choice !== "essential") throw new Error(`essential_cookie_choice_not_persisted:${choice}`);
    return { choice, dismissed: true };
  });

  await browserCase(`shell-home-${viewport.id}`, "/", async (page) => {
    const result = await assertNaturalPage(page, "/");
    const rails = await page.locator("[data-horizontal-rail]").count();
    const tabs = await page.locator('[role="tab"]').count();
    if (rails < 3 || tabs < 2) throw new Error(`home_slider_contract:rails=${rails},tabs=${tabs}`);
    return { ...result, rails, tabs, ...(await verifyImages(page)) };
  });

  const mapRoutes = [
    ["vacations", "/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"], ["events", "/events/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"], ["hourly", "/hourly"], ["spa", "/spas"], ["activities", "/attractions"],
  ];
  for (const [world, path] of mapRoutes) {
    await browserCase(`map-${world}-${viewport.id}`, path, async (page) => {
      await assertNaturalPage(page, path);
      return { ...(await verifyResultsMap(page)), ...(await verifyImages(page)) };
    });
  }

  const places = [
    ["vacation", "/business?id=vacation-116", { phone: true, gallery: true, map: true }], ["event", "/events/place/event-2575", { phone: true, gallery: true, map: true }], ["hourly", "/discover/place/hourly-475", { phone: true, gallery: false, map: true }], ["spa", "/discover/place/spa-6", { phone: false, gallery: false, map: true }],
  ];
  for (const [world, path, expectations] of places) await browserCase(`place-${world}-${viewport.id}`, path, (page) => verifyPlace(page, path, expectations));

  await browserCase(`navigation-back-${viewport.id}`, "public navigation", async (page) => {
    await assertNaturalPage(page, "/");
    const link = page.locator('a[href="/search"],a[href^="/search?"]').first();
    if (!await link.count()) throw new Error("home_search_link_missing");
    await link.click();
    await page.waitForFunction(() => location.pathname === "/search", null, { timeout: 15_000 });
    await page.goBack({ waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname !== "/") throw new Error(`back_wrong_route:${page.url()}`);
    return { url: page.url() };
  });

  const screenshot = join(outputDir, `public-${viewport.id}.png`);
  await browserCase(`screenshot-${viewport.id}`, "/", async (page) => {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: screenshot, fullPage: true });
    return screenshot;
  });
  await Promise.race([
    context.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
}

(async () => {
  const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  try {
    if (process.env.QA_LOCALE_ONLY !== "1") {
      const requestedViewports = new Set((process.env.QA_VIEWPORTS || "desktop,mobile,low-height").split(",").map((value) => value.trim()).filter(Boolean));
      const coreViewports = [
        { id: "desktop", size: { width: 1440, height: 900 } },
        { id: "mobile", size: { width: 390, height: 844 } },
        { id: "low-height", size: { width: 390, height: 620 } },
      ].filter((viewport) => requestedViewports.has(viewport.id));
      if (!coreViewports.length) throw new Error("qa_viewports_empty_or_invalid");
      for (const viewport of coreViewports) await runViewport(browser, viewport);
    }
    if (process.env.QA_CORE_ONLY !== "1" && process.env.QA_LOCALE_STRESS_ONLY !== "1") {
      await runLocaleMatrix(browser, { id: "desktop", size: { width: 1440, height: 900 } });
      await runLocaleMatrix(browser, { id: "mobile", size: { width: 390, height: 844 } });
    }
    if (process.env.QA_CORE_ONLY !== "1") {
      await runLocaleMatrix(browser, { id: "desktop-1365", size: { width: 1365, height: 768 } }, [
        ["home", "/"],
        ["guides", "/guides"],
        ["gift-card", "/gift-card"],
      ]);
    }
  } finally {
    await browser.close();
  }
  report.finishedAt = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter((item) => item.status === "passed").length, failed: report.cases.filter((item) => item.status === "failed").length };
  report.status = report.summary.failed ? "failed" : "passed";
  const path = join(outputDir, `comprehensive-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path, status: report.status, summary: report.summary }, null, 2));
  process.exitCode = report.summary.failed ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
