import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

const currentPath = new URL("../app/data/legacy-gallery-media.json", import.meta.url);
const current = JSON.parse(await fs.readFile(currentPath, "utf8"));
const previous = JSON.parse(
  execFileSync("git", ["show", "HEAD:app/data/legacy-gallery-media.json"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }),
);
const previousSet = new Set(previous.files);
const added = current.files.filter((filename) => !previousSet.has(filename));
const failures = [];
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= added.length) return;
    const filename = added[index];
    const url = `https://www.vii.co.il/gallery/${encodeURIComponent(filename)}`;
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
        failures.push({ filename, status: response.status, contentType });
      }
    } catch (error) {
      failures.push({ filename, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: 20 }, () => worker()));
console.log(JSON.stringify({ current: current.files.length, previous: previous.files.length, added: added.length, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
