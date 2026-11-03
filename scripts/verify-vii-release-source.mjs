#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const allowDirty = process.argv.includes("--allow-dirty");
const refIndex = process.argv.indexOf("--ref");
const candidateRef = refIndex >= 0 ? process.argv[refIndex + 1] : "HEAD";
if (!candidateRef) throw new Error("--ref requires a Git reference");
const manifestPath = resolve(root, "project_knowledge/release_controls/vii-accepted-capabilities.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

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
  controlId: manifest.controlId,
  ref: candidateRef,
  head: git("rev-parse", candidateRef),
  tree: git("rev-parse", `${candidateRef}^{tree}`),
  clean: candidateRef === "HEAD" ? !status : null,
  protectedAncestors: manifest.protectedAncestors.length,
  requiredCapabilities: manifest.requiredCapabilities.length,
  status: failures.length ? "failed" : "passed",
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
