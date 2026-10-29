import { readFile, writeFile } from "node:fs/promises";

const inventory = JSON.parse(
  await readFile(new URL("../app/data/legacy-redirect-inventory.json", import.meta.url), "utf8"),
);
const release = process.argv[2] || "unversioned";
const origin = "https://vii.spaplus.co";
const entries = [
  ...Object.entries(inventory.redirects).map(([path, target]) => ({ path, target, expected: 301 })),
  ...inventory.gone.map((path) => ({ path, target: null, expected: 410 })),
];
const failures = [];
let cursor = 0;

async function inspect(entry) {
  const response = await fetch(`${origin}${entry.path}`, {
    method: "GET",
    redirect: "manual",
    headers: { "user-agent": "VII-Legacy-Redirect-Audit/1.0" },
  });
  if (response.status !== entry.expected) {
    failures.push({ ...entry, actual: response.status, reason: "unexpected_status" });
    return;
  }
  if (entry.expected === 410) return;
  const location = response.headers.get("location");
  const expectedLocation = new URL(entry.target, origin).href;
  const actualLocation = location ? new URL(location, origin).href : null;
  if (actualLocation !== expectedLocation) {
    failures.push({ ...entry, actual: response.status, location, reason: "wrong_location" });
    return;
  }
  const finalResponse = await fetch(expectedLocation, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": "VII-Legacy-Redirect-Audit/1.0" },
  });
  if (finalResponse.status !== 200) {
    failures.push({ ...entry, actual: finalResponse.status, location, reason: "target_not_200" });
  }
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= entries.length) return;
    try {
      await inspect(entries[index]);
    } catch (error) {
      failures.push({ ...entries[index], reason: "request_error", error: String(error) });
    }
  }
}

await Promise.all(Array.from({ length: 32 }, worker));
const report = {
  checkedAt: new Date().toISOString(),
  release,
  total: entries.length,
  redirects: Object.keys(inventory.redirects).length,
  gone: inventory.gone.length,
  checked: entries.length,
  passed: failures.length === 0,
  failureCount: failures.length,
  failures,
};
const output = new URL(
  `../project_knowledge/release_evidence/vii-legacy-content-redirects-20261029/${release}-live-audit.json`,
  import.meta.url,
);
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
