import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import detailsSource from "../app/data/sergey-place-details.json" with { type: "json" };

const concurrency = 8;
const deadline = Date.now() + 5 * 60_000;
const entries = Object.entries(detailsSource.details)
  .filter(([id, detail]) => id.startsWith("vacation-") && typeof detail.sourceUrl === "string" && detail.sourceUrl.startsWith("https://www.vii.co.il/"));

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function agreementFromHtml(html) {
  const match = html.match(/\[agreement1\]\s*=>\s*([\s\S]*?)\s*\[agreement2\]\s*=>/i);
  if (!match) return "";
  const agreement = decodeHtml(match[1]);
  return agreement.length >= 50 && /ביטול|דמי\s+ביטול/.test(agreement) ? agreement : "";
}

const policies = {};
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < entries.length) {
    if (Date.now() > deadline) throw new Error("Legacy policy snapshot deadline exceeded");
    const [id, detail] = entries[cursor++];
    try {
      const response = await fetch(detail.sourceUrl, { headers: { "User-Agent": "VII-policy-migration/1.0" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const agreement = agreementFromHtml(await response.text());
      if (agreement) policies[id] = agreement;
    } catch (error) {
      failures.push({ id, reason: error instanceof Error ? error.message : "unknown" });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const ordered = Object.fromEntries(Object.entries(policies).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true })));
const output = {
  source: "legacy-vii-public-place-pages",
  fetchedAt: new Date().toISOString(),
  coverage: { requested: entries.length, captured: Object.keys(ordered).length, failures: failures.length },
  sha256: createHash("sha256").update(JSON.stringify(ordered)).digest("hex"),
  policies: ordered,
};
await writeFile(new URL("../app/data/legacy-place-agreements.json", import.meta.url), `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({ ...output.coverage, sha256: output.sha256, sample: ordered["vacation-296"]?.slice(0, 160) || "" }));
