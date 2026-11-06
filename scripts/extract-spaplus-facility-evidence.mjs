import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../app/data/spaplus-catalog.json", import.meta.url), "utf8"));
const output = new URL("../app/data/spaplus-official-facility-evidence.json", import.meta.url);
const sites = catalog.sites.filter((site) => site.city === "תל אביב" && typeof site.bookingUrl === "string");
const observedAt = new Date().toISOString();
const queue = [...sites];
const entries = {};
async function worker() {
  while (queue.length) {
    const site = queue.shift();
    try {
      const response = await fetch(site.bookingUrl, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
      const html = await response.text();
      if (!response.ok || response.url && !new URL(response.url).hostname.endsWith("spaplus.co.il")) throw new Error(`http_${response.status}`);
      const start = html.lastIndexOf("מאפייני המקום");
      const end = html.indexOf("תיאור המקום", start);
      const section = start >= 0 && end > start ? html.slice(start, end) : "";
      const labels = [], facilityIds = [];
      for (const match of section.matchAll(/<div[^>]*data-cid=['\"]([^'\"]+)['\"][^>]*>[\s\S]{0,12000}?<span>([^<]+)<\/span>(?:<desc>([^<]*)<\/desc>)?/gi)) {
        const label = match[2].replace(/\\/g, "").replace(/\s+/g, " ").trim();
        if (!label) continue;
        labels.push(label);
        const ids = match[1].split(",").map(Number).filter(Number.isSafeInteger);
        facilityIds.push(...ids);
      }
      const optionalPool = html.includes("כניסה לבריכה ב200") && html.includes("החבילה לא כוללת כניסה לבריכה");
      const quoteIndex = optionalPool ? html.lastIndexOf("כניסה לבריכה") : -1;
      const packageId = quoteIndex >= 0 ? (html.slice(Math.max(0, quoteIndex - 5000), quoteIndex).match(/https:\/\/www\.spaplus\.co\.il\/[^\" ]+\/([0-9]+)_package[^\" ]*/g)?.at(-1)?.match(/\/([0-9]+)_package/)?.[1] || null) : null;
      entries[String(site.id)] = { sourceUrl: site.bookingUrl, checkedAt: observedAt, htmlSha256: createHash("sha256").update(html).digest("hex"), providerFacilityIds: [...new Set(facilityIds)], labels: [...new Set(labels)], ...(optionalPool ? { optionalFeatures: [{ label: "בריכה", kind: "optional-paid", ...(packageId ? { packageId } : {}), sourceQuote: "כניסה לבריכה ב200 ש\"ח לאדם בהתאם לזמינות" }] } : {}) };
    } catch (error) { entries[String(site.id)] = { sourceUrl: site.bookingUrl, checkedAt: observedAt, error: error instanceof Error ? error.message : "unavailable" }; }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await writeFile(output, `${JSON.stringify({ schemaVersion: 2, source: "official-spaplus-place-pages", checkedAt: observedAt, scope: "tel-aviv-active-sites", entries }, null, 2)}\n`);
console.log(JSON.stringify({ sites: sites.length, ok: Object.values(entries).filter((entry) => !entry.error).length, failed: Object.values(entries).filter((entry) => entry.error).length, output: output.pathname }));
