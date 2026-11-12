import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("..", import.meta.url));
const script = join(project, ".openai", "prepare-vii-release-handoff.ps1");
const identity = join(project, "scripts", "release-build-identity.mjs");

function git(cwd, ...args) { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }

test("handoff operator fails closed before writing when candidate manifest is missing", {skip:process.platform!=='win32'?'Native Windows publication operator; manifest logic has portable tests':false}, () => {
  const root = mkdtempSync(join(tmpdir(), "vii-release-operator-"));
  try {
    mkdirSync(join(root, ".openai"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "app"), { recursive: true });
    writeFileSync(join(root, ".openai", "prepare-vii-release-handoff.ps1"), readFileSync(script));
    writeFileSync(join(root, "scripts", "release-build-identity.mjs"), readFileSync(identity));
    writeFileSync(join(root, "package.json"), "{}\n");
    writeFileSync(join(root, "app", "page.tsx"), "export default function Page(){return null}\n");
    git(root, "init");
    git(root, "config", "user.email", "qa@example.invalid");
    git(root, "config", "user.name", "VII QA");
    git(root, "add", "."); git(root, "commit", "-m", "fixture");
    git(root, "branch", "release/test");
    git(root, "update-ref", "refs/remotes/origin/release/test", "HEAD");
    let error;
    try { execFileSync("pwsh", ["-NoProfile", "-File", join(root, ".openai", "prepare-vii-release-handoff.ps1"),
      "-VersionNumber", "901", "-Branch", "release/test", "-Summary", "fixture", "-FocusedTests", "1", "-FullTests", "1",
      "-RollbackVersionId", "rollback", "-RollbackDeploymentId", "deployment", "-EnvironmentRevision", "1",
      "-CandidateManifestPath", join(root, "missing-manifest.json"),
      "-RetainedAssetsReceiptPath", join(root, "missing-retained-assets.json")], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
    catch (caught) { error = caught; }
    assert.ok(error, "operator unexpectedly accepted a missing manifest");
    assert.notEqual(error.status, 0);
    assert.equal(existsSync(join(root, "project_knowledge", "release_handoffs", "v901.json")), false);
  } finally {
    assert.equal(resolve(dirname(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('vii-release-operator-'));
    rmSync(root, { recursive: true, force: true });
  }
});
