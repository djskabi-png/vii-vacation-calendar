import { writeFile } from "node:fs/promises";
import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import details from "../app/data/sergey-place-details.json" with { type: "json" };
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";

const target = (process.env.VII_AUDIT_TARGET || "http://127.0.0.1:3291").replace(/\/$/, "");
const output = process.env.VII_AUDIT_OUTPUT || "project_knowledge/release_evidence/vii-api-canonical-sample.json";
const samples = {
  vacations: [11, 2229, 1772, 470, 1406, 2210, 2574, 2483, 2281, 2705],
  events: [2, 65, 70, 124, 129, 184, 210, 225, 226, 260],
};

const normalize = (value) => JSON.parse(JSON.stringify(value ?? null));
const same = (left, right) => JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
const checks = [];

async function request(path, json = false) {
  const response = await fetch(`${target}${path}`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: json ? await response.json() : await response.text() };
}

for (const [world, ids] of Object.entries(samples)) {
  for (const supplierId of ids) {
    const prefix = world === "vacations" ? "vacation" : "event";
    const slug = `${prefix}-${supplierId}`;
    const expectedSummary = projectSergeyPublicCatalogValue(catalog.places.find((place) => place.slug === slug));
    const expectedDetail = projectSergeyPublicCatalogValue(details.details[slug]);
    const api = await request(`/api/catalog?world=${world}&id=${supplierId}`, true);
    const pagePath = world === "vacations" ? `/business?id=${slug}` : `/events/place/${slug}`;
    const page = await request(pagePath);
    const entry = api.body?.entry;
    const failures = [];
    if (api.status !== 200) failures.push(`api_status_${api.status}`);
    if (page.status !== 200) failures.push(`page_status_${page.status}`);
    if (!expectedSummary || !expectedDetail) failures.push("missing_bundled_baseline");
    if (!entry || entry.supplierId !== supplierId) failures.push("wrong_supplier_identity");
    if (expectedSummary && !same(entry?.summary, expectedSummary)) failures.push("summary_mismatch");
    for (const field of ["images", "galleryGroups", "features", "featureGroups", "rooms"]) {
      if (expectedDetail && !same(entry?.detail?.[field], expectedDetail[field])) failures.push(`${field}_mismatch`);
    }
    if (expectedSummary?.name && !page.body.includes(expectedSummary.name)) failures.push("page_name_missing");
    if (world === "vacations" && expectedDetail?.rooms?.length && !page.body.includes("איפה תשנו")) failures.push("sleeping_details_missing");
    if (world === "vacations" && expectedDetail?.featureGroups?.length && !page.body.includes("מתקנים ושירותים")) failures.push("facility_heading_missing");
    if (world === "events" && expectedDetail?.featureGroups?.length && !page.body.includes("מתקנים נוספים")) failures.push("event_facility_heading_missing");
    if (slug === "event-210") {
      if (!page.body.includes("בריכת שחיה מחוממת")) failures.push("heated_pool_label_missing");
      if (page.body.includes("בריכת שחיה מרעננת")) failures.push("stale_pool_label_present");
    }
    checks.push({ world, supplierId, slug, apiStatus: api.status, pageStatus: page.status,
      imageCount: entry?.detail?.images?.length || 0, galleryGroupCount: entry?.detail?.galleryGroups?.length || 0,
      roomCount: entry?.detail?.rooms?.length || 0, featureGroupCount: entry?.detail?.featureGroups?.length || 0,
      failures });
  }
}

for (const search of [
  { id: "north-undated", path: "/vacations/north" },
  { id: "north-dated", path: "/vacations/north?from=2026-11-12&till=2026-11-15&guests=2&rooms=1" },
]) {
  const result = await request(search.path);
  const failures = [];
  if (result.status !== 200) failures.push(`status_${result.status}`);
  if (!result.body.includes("נופש בצפון")) failures.push("search_heading_missing");
  if (result.body.includes("העמוד לא נטען במלואו")) failures.push("search_error_state");
  checks.push({ world: "search", slug: search.id, pageStatus: result.status, failures });
}

const failures = checks.flatMap((check) => check.failures.map((failure) => ({ slug: check.slug, failure })));
const report = { generatedAt: new Date().toISOString(), target, sample: { vacations: 10, events: 10, searches: 2 },
  checks, failures, passed: failures.length === 0 };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, passed: report.passed, checks: checks.length, failures }, null, 2));
if (!report.passed) process.exitCode = 1;
