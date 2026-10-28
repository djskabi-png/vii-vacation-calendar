#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const startedAt = new Date().toISOString();
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "qqqaaa");
mkdirSync(outputDir, { recursive: true });
const suites = [
  ["vii-unified-19", ["qa:vii-unified-19"]],
  ["vii-unified-19-public", ["qa:vii-unified-19-public"]],
  ["navigation-and-unit-results", ["qa:navigation-unit-results"]],
  ["flexible-online-search", ["qa:flexible-online-search"]],
  ["admin-customer-auth-boundaries", ["qa:auth-boundaries"]],
  ["pre-professor-production-repairs", ["qa:pre-professor-repairs"]],
  ["production-build-and-all-tests", ["test"]],
  ["regression-guard-matrix", ["qa:regression-guards"]],
  ["search-state", ["audit:search"]],
  ["availability-matrix", ["audit:availability"]],
  ["catalog-fallback-parity", ["qa:catalog-fallback"]],
  ["feature-icon-geometry", ["qa:icon-geometry"]],
  ["header-control-spacing", ["qa:spacing"]],
  ["overlay-geometry", ["qa:overlay-geometry"]],
  ["map-experience", ["qa:map"]],
  ["multilingual-production", ["qa:locales"]],
  ["responsive-transitions", ["qa:responsive-transitions"]],
  ["sitewide-release", ["qa:site"]],
  ["public-production-matrix", ["qa:production"]],
];
const report = { schemaVersion: 1, trigger: "QQQAAA", startedAt, baseUrl: process.env.BASE_URL || "https://vii.spaplus.co", exclusions: ["accessibility", "typography"], suites: [] };
async function runSuite(id, args) {
  const started = Date.now();
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  const result = await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: { ...process.env, QA_OUTPUT_DIR: join(outputDir, id) },
      stdio: "inherit",
      windowsHide: true,
    });
    let launchError = null;
    child.once("error", (error) => {
      launchError = { code: error.code || null, message: error.message };
    });
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal, launchError }));
  });
  report.suites.push({
    id,
    status: result.exitCode === 0 ? "passed" : "failed",
    exitCode: result.exitCode,
    signal: result.signal || null,
    launchError: result.launchError,
    durationMs: Date.now() - started,
  });
}

async function main() {
  for (const [id, args] of suites) await runSuite(id, args);
  report.finishedAt = new Date().toISOString();
  report.status = report.suites.length === suites.length && report.suites.every((suite) => suite.status === "passed") ? "passed" : "failed";
  const reportPath = join(outputDir, `qqqaaa-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ trigger: report.trigger, report: reportPath, status: report.status, suites: report.suites }, null, 2));
  process.exitCode = report.status === "passed" ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
