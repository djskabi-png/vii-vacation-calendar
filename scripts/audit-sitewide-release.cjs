#!/usr/bin/env node
"use strict";

const { mkdirSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const reportDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports");
mkdirSync(reportDir, { recursive: true });
const report = { baseUrl, startedAt: new Date().toISOString(), steps: [] };
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(name, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, { encoding: "utf8", shell: options.shell ?? false, env: process.env });
  const step = {
    name,
    command: [command, ...args].join(" "),
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
  report.steps.push(step);
  return step.exitCode === 0;
}

function runPackageScript(name, script) {
  const npmExecPath = process.env.npm_execpath || "";
  if (/\.(?:c?js|mjs)$/i.test(npmExecPath)) return run(name, process.execPath, [npmExecPath, script]);
  return run(name, pnpm, [script], { shell: process.platform === "win32" });
}

const ok = [
  runPackageScript("build-and-source-tests", "test"),
  run("shared-header-first-action-matrix", process.execPath, ["scripts/audit-header-first-click.cjs", "--base-url", baseUrl]),
  run("search-and-responsive-state-matrix", process.execPath, ["scripts/audit-search-state.cjs", "--base-url", baseUrl]),
  run("public-seo-and-structured-data", process.execPath, ["scripts/audit-public-seo.mjs", baseUrl]),
].every(Boolean);

report.finishedAt = new Date().toISOString();
report.status = ok ? "passed-automated-gates" : "blocked-automated-gates";
const reportFile = join(reportDir, `sitewide-${Date.now()}.json`);
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, reportFile, baseUrl, steps: report.steps.map(({ name, exitCode, durationMs }) => ({ name, exitCode, durationMs })) }, null, 2));
process.exitCode = ok ? 0 : 1;
