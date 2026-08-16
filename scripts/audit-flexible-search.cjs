#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");

const baseUrl = (process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const route = "/search/?location=%D7%9B%D7%9C+%D7%94%D7%90%D7%A8%D7%A5&dateMode=flexible&stay=weekend&month=2026-09&flexDays=3&guests=2";

async function inspect(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const cards = [...document.querySelectorAll(".stay-card")].map((card, index) => {
      const availability = card.querySelector(".stay-card__availability")?.textContent?.trim() || "";
      const price = card.querySelector(".stay-card__price--known")?.textContent?.trim() || "";
      const quickBooking = Boolean(card.querySelector("a.stay-card__details-link--booking[href*='/booking?']"));
      return { index, availability, price, quickBooking, text: card.textContent?.trim().slice(0, 220) || "" };
    });
    const firstBookable = cards.findIndex((card) => card.quickBooking);
    return {
      cards,
      firstBookable,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      mainVisible: Boolean(document.querySelector("main")?.getBoundingClientRect().height),
      summary: document.querySelector(".availability-demo-summary--live")?.textContent?.trim() || "",
      errors: [],
    };
  });
}

async function run(width, height) {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width <= 500, hasTouch: width <= 500 });
  const errors = [];
  const failedResponses = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });
  try {
    await page.goto(`${baseUrl}${route}&v=flexible-release`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForSelector(".stay-card", { timeout: 30000 });
    await page.waitForFunction(() => Boolean(document.querySelector("a.stay-card__details-link--booking[href*='/booking?']")), undefined, { timeout: 30000 });
    const state = await inspect(page);
    state.errors = errors;
    state.failedResponses = failedResponses;
    const failures = [];
    if (!state.mainVisible) failures.push("main-not-visible");
    if (state.horizontalOverflow) failures.push("horizontal-overflow");
    if (!state.summary) failures.push("flexible-priority-summary-missing");
    if (state.firstBookable < 0) failures.push("no-available-priced-result");
    if (state.firstBookable > 0) failures.push("available-priced-result-not-first");
    if (state.errors.length) failures.push("console-errors");
    return { viewport: `${width}x${height}`, state, failures };
  } finally {
    await browser.close();
  }
}

(async () => {
  const reports = [await run(390, 844), await run(1440, 1000)];
  const failures = reports.flatMap((report) => report.failures.map((failure) => `${report.viewport}:${failure}`));
  const output = { baseUrl, route, passed: failures.length === 0, failures, reports };
  if (process.argv.includes("--compact")) {
    console.log(JSON.stringify({
      baseUrl,
      route,
      passed: output.passed,
      failures,
      reports: reports.map(({ viewport, state, failures: reportFailures }) => ({
        viewport,
        firstBookable: state.firstBookable,
        cards: state.cards.length,
        firstCard: state.cards[0] ? {
          availability: state.cards[0].availability,
          price: state.cards[0].price,
          quickBooking: state.cards[0].quickBooking,
        } : null,
        horizontalOverflow: state.horizontalOverflow,
        mainVisible: state.mainVisible,
        summary: state.summary,
        consoleErrors: state.errors.length,
        errorSamples: [...new Set(state.errors)].slice(0, 5),
        failedResponseSamples: state.failedResponses.slice(0, 5),
        failures: reportFailures,
      })),
    }, null, 2));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
