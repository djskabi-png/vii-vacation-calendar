#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildImpact, loadImpactGraph } from "./release-impact-graph.mjs";

const root = process.cwd();
const allowDirty = process.argv.includes("--allow-dirty");
const refIndex = process.argv.indexOf("--ref");
const candidateRef = refIndex >= 0 ? process.argv[refIndex + 1] : "HEAD";
if (!candidateRef) throw new Error("--ref requires a Git reference");
const manifestPath = resolve(root, "project_knowledge/release_controls/vii-accepted-capabilities.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const impactIndex = process.argv.indexOf("--impact-files");
const graph = loadImpactGraph(root);
const baseIndex = process.argv.indexOf("--base");
const impactBase = baseIndex >= 0 ? process.argv[baseIndex + 1] : graph.baselineSource;
let changedFiles = [];
try {
  changedFiles = git("diff", "--name-only", impactBase, candidateRef, "--").split(/\r?\n/).filter(Boolean);
  if (candidateRef === "HEAD") changedFiles.push(...git("diff", "--name-only", "HEAD", "--").split(/\r?\n/).filter(Boolean), ...git("ls-files", "--others", "--exclude-standard").split(/\r?\n/).filter(Boolean));
} catch { failures.push("release impact baseline is unavailable"); }
const requestedImpactFiles = [];
if (impactIndex >= 0) for (const value of process.argv.slice(impactIndex + 1)) { if (value.startsWith("--")) break; requestedImpactFiles.push(value); }
// Explicit examples can widen the scope, never replace the actual Git diff.
const impact = buildImpact(graph, [...changedFiles, ...requestedImpactFiles], { root });
if (impact.status === "blocked") failures.push("release impact graph has unknown, ambiguous or invalid ownership");
if (candidateRef !== "HEAD") {
  for (const path of ["project_knowledge/release_controls/vii-release-impact-graph.json", "app/lib/quality-platform.ts"]) {
    try { if (git("show", `${candidateRef}:${path}`) !== readFileSync(resolve(root, path), "utf8").trim()) failures.push(`impact definition differs from candidate: ${path}`); }
    catch { failures.push(`impact definition missing from candidate: ${path}`); }
  }
}

for (const item of manifest.protectedAncestors) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", item.commit, candidateRef], { cwd: root, stdio: "ignore" }); }
  catch { failures.push(`missing protected ancestor ${item.commit}: ${item.capability}`); }
}

for (const capability of manifest.requiredCapabilities) {
  for (const path of capability.files) {
    let present = false;
    if (candidateRef === "HEAD") present = existsSync(resolve(root, path));
    else {
      try { execFileSync("git", ["cat-file", "-e", `${candidateRef}:${path}`], { cwd: root, stdio: "ignore" }); present = true; }
      catch { present = false; }
    }
    if (!present) failures.push(`missing ${capability.id}: ${path}`);
  }
}

const status = git("status", "--porcelain");
if (candidateRef === "HEAD" && !allowDirty && status) failures.push("candidate worktree is not clean");

const report = {
  verificationScope: "source-integrity-only",
  publicationApproved: false,
  controlId: manifest.controlId,
  ref: candidateRef,
  head: git("rev-parse", candidateRef),
  tree: git("rev-parse", `${candidateRef}^{tree}`),
  clean: candidateRef === "HEAD" ? !status : null,
  protectedAncestors: manifest.protectedAncestors.length,
  requiredCapabilities: manifest.requiredCapabilities.length,
  status: failures.length ? "failed" : "passed",
  failures,
  impact,
  impactBase,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
