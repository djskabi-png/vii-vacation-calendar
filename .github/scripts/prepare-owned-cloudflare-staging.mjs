import { readFile, writeFile } from "node:fs/promises";

const accountId = "45b2f6dcf2cfe44204d2c470cbe682d9";
const workerName = "vii-owned-migration-staging";
const stagingId = "23aa3e6f-8ba4-4e00-aa79-28c7207562e8";
const dryRun = process.argv.includes("--dry-run");

const inputPath = new URL("../../dist/server/wrangler.json", import.meta.url);
const generated = JSON.parse(await readFile(inputPath, "utf8"));
if (generated.main !== "index.js" || generated.assets?.binding !== "ASSETS" || generated.assets.directory !== "../client") {
  throw new Error("Unexpected Vinext build layout. Review the generated Worker before uploading.");
}

const config = {
  name: workerName,
  account_id: accountId,
  main: generated.main,
  compatibility_date: generated.compatibility_date,
  compatibility_flags: generated.compatibility_flags,
  no_bundle: generated.no_bundle,
  rules: generated.rules,
  assets: generated.assets,
  workers_dev: false,
  preview_urls: false,
  d1_databases: [{
    binding: "DB",
    database_name: "vii-owned-migration-staging-db",
    database_id: dryRun ? "00000000-0000-4000-8000-000000000000" : stagingId,
  }],
  r2_buckets: [{ binding: "UPLOADS", bucket_name: "vii-owned-migration-staging-media" }],
  images: { binding: "IMAGES" },
};
const outputPath = new URL("../../dist/server/wrangler.owned-staging.json", import.meta.url);
await writeFile(outputPath, JSON.stringify(config, null, 2) + "\n");
