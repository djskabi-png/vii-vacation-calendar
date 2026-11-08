import { writeFile } from "node:fs/promises";
import {legacyAccommodationTypeOptions} from '../app/lib/legacy-accommodation-type-options.ts';

const sourceUrl = "https://www.vii.co.il/s/israel/16096";
const output = process.argv[2]
  ? new URL(process.argv[2], import.meta.url)
  : new URL("../app/data/legacy-vacation-accommodation-types.json", import.meta.url);
const typeOptions = legacyAccommodationTypeOptions;

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

function idsFromHtml(html) {
  return [...new Set([...html.matchAll(/data-siteid="(\d+)"/g)].map((match) => Number(match[1])))]
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .sort((left, right) => left - right);
}

const page = await fetch(sourceUrl, { redirect: "error", signal: AbortSignal.timeout(30_000) });
if (!page.ok) throw new Error(`legacy_type_source_http_${page.status}`);
const html = await page.text();
const hash = html.match(/new SearchFilter\((\d+),/)?.[1];
if (!hash) throw new Error("legacy_type_source_missing_hash");
const cookie = cookieHeader(page);
const memberships = {};
const counts = {};

for (const [typeId, label] of typeOptions) {
  const body = new URLSearchParams({ act: "results", hs: hash });
  body.append("roomTypes[]", String(typeId));
  const response = await fetch("https://www.vii.co.il/ajax_filter.php", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...(cookie ? { cookie } : {}),
    },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`legacy_type_${typeId}_http_${response.status}`);
  const payload = await response.json();
  if (Number(payload.status) !== 0 || typeof payload.html !== "string") throw new Error(`legacy_type_${typeId}_invalid_payload`);
  const ids = idsFromHtml(payload.html);
  const reportedCount = Number(payload.count);
  if (!Number.isSafeInteger(reportedCount) || reportedCount !== ids.length) {
    throw new Error(`legacy_type_${typeId}_coverage_${reportedCount}_${ids.length}`);
  }
  counts[label] = ids.length;
  for (const supplierId of ids) memberships[supplierId] = [...new Set([...(memberships[supplierId] || []), label])];
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceUrl,
  sourceHash: Number(hash),
  counts,
  memberships,
};
await writeFile(output, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(JSON.stringify({ output: output.pathname, counts, suppliers: Object.keys(memberships).length }));
