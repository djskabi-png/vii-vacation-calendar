#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const startedAt = new Date().toISOString();
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "qqqaaa");
mkdirSync(outputDir, { recursive: true });
const suites = [
  ["production-build-and-all-tests", ["test"]],
  ["regression-guard-matrix", ["qa:regression-guards"]],
  ["search-state", ["audit:search"]],
  ["availability-matrix", ["audit:availability"]],
  ["feature-icon-geometry", ["qa:icon-geometry"]],
  ["sitewide-release", ["qa:site"]],
  ["public-production-matrix", ["qa:production"]],
];
const report = { schemaVersion: 1, trigger: "QQQAAA", startedAt, baseUrl: process.env.BASE_URL || "https://vii.spaplus.co", exclusions: ["accessibility", "typography"], suites: [] };
for (const [id, args] of suites) {
  const started = Date.now();
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  const result = spawnSync(command, commandArgs, { cwd: process.cwd(), env: { ...process.env, QA_OUTPUT_DIR: join(outputDir, id) }, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  report.suites.push({ id, status: result.status === 0 ? "passed" : "failed", exitCode: result.status, launchError: result.error ? { code: result.error.code || null, message: result.error.message } : null, durationMs: Date.now() - started });
}
report.finishedAt = new Date().toISOString();
report.status = report.suites.length === suites.length && report.suites.every((suite) => suite.status === "passed") ? "passed" : "failed";
const reportPath = join(outputDir, `qqqaaa-${Date.now()}.json`);
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ trigger: report.trigger, report: reportPath, status: report.status, suites: report.suites }, null, 2));
process.exitCode = report.status === "passed" ? 0 : 1;
