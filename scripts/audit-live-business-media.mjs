#!/usr/bin/env node
import { chromium } from "playwright";

const baseUrl = String(process.env.VII_PUBLIC_BASE_URL || process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const target = String(process.env.VII_BUSINESS_PATH || process.argv[3] || "/business?id=vacation-164");
const url = new URL(target, `${baseUrl}/`).href;

const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "request_failed" }));
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(6_000);
    const state = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector("h1")?.textContent?.trim() || "",
      globalError: document.querySelector(".error-state-page")?.textContent?.replace(/\s+/g, " ").trim() || "",
      rooms: [...document.querySelectorAll(".room-card")].map((card) => ({
        name: card.querySelector("h3")?.textContent?.trim() || "",
        fallback: card.querySelector(".room-card__image--missing")?.textContent?.replace(/\s+/g, " ").trim() || "",
        image: (() => {
          const image = card.querySelector(".room-card__image img");
          return image ? { src: image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, alt: image.alt } : null;
        })(),
      })),
    }));
    const broken = state.rooms.filter((room) => room.image && room.image.complete && room.image.naturalWidth === 0);
    if (state.globalError || pageErrors.length || broken.length) failed = true;
    console.log(JSON.stringify({ viewport: viewport.name, status: response?.status(), url: page.url(), ...state, broken, pageErrors, consoleErrors, failedRequests }, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
