import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releaseBuildIdentity } from "../scripts/release-build-identity.mjs";

test("public cache identity is deterministic for the frozen source", () => {
  const files = ["app/page.tsx", "package.json"];
  const first = releaseBuildIdentity({ files, cwd: process.cwd() });
  assert.equal(first, releaseBuildIdentity({ files, cwd: process.cwd() }));
  assert.match(first, /^[a-f0-9-]{36}$/);
  assert.notEqual(first, releaseBuildIdentity({ files: ["app/page.tsx"], cwd: process.cwd() }));
});

test("documentation and tests do not affect deployable identity, but source and binary inputs do", () => {
  const source = ["app/page.tsx", "package.json"];
  const baseline = releaseBuildIdentity({ files: source });
  assert.equal(baseline, releaseBuildIdentity({ files: [...source, "tests/ignored.test.mjs"] }));
  assert.equal(baseline, releaseBuildIdentity({ files: [...source, "docs/ignored.md"] }));
  assert.equal(baseline, releaseBuildIdentity({ files: [...source, "services/vii-quality-control/src/controller.ts"] }));
  assert.equal(baseline, releaseBuildIdentity({ files: [...source, "services/vii-edge-delivery/src/index.ts"] }));
  assert.notEqual(baseline, releaseBuildIdentity({ files: ["app/page.tsx"] }));
});

test("text newline style is canonicalized while binary and text changes remain visible", () => {
  const cwd = mkdtempSync(join(tmpdir(), "vii-build-id-"));
  try {
    mkdirSync(join(cwd, "app")); mkdirSync(join(cwd, "public"));
    writeFileSync(join(cwd, "app/source.ts"), "export const x = 1;\n");
    writeFileSync(join(cwd, "public/source.bin"), Buffer.from([0, 255]));
    const files = ["app/source.ts", "public/source.bin"];
    const lf = releaseBuildIdentity({ cwd, files });
    writeFileSync(join(cwd, "app/source.ts"), "export const x = 1;\r\n");
    assert.equal(lf, releaseBuildIdentity({ cwd, files }));
    writeFileSync(join(cwd, "app/source.ts"), "export const x = 2;\r\n");
    assert.notEqual(lf, releaseBuildIdentity({ cwd, files }));
    writeFileSync(join(cwd, "public/source.bin"), Buffer.from([0, 254]));
    assert.notEqual(lf, releaseBuildIdentity({ cwd, files }));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("build identity fails closed when no deployable inputs exist", () => {
  assert.throws(() => releaseBuildIdentity({ files: [] }), /release_source_identity_unavailable/);
});

test("Windows checkout text inputs match Linux across infrastructure and extensionless hosting files", () => {
  const cwd = mkdtempSync(join(tmpdir(), "vii-cross-platform-id-"));
  const files = ["infrastructure/deploy.py", "infrastructure/wrangler.jsonc", "infrastructure/.gitignore", "public/_headers", "public/_redirects"];
  try {
    mkdirSync(join(cwd, "infrastructure")); mkdirSync(join(cwd, "public"));
    for (const path of files) writeFileSync(join(cwd, path), "first line\nsecond line\n");
    const linux = releaseBuildIdentity({ cwd, files });
    for (const path of files) writeFileSync(join(cwd, path), "first line\r\nsecond line\r\n");
    assert.equal(releaseBuildIdentity({ cwd, files }), linux);
    writeFileSync(join(cwd, "public/_headers"), "changed header\r\n");
    assert.notEqual(releaseBuildIdentity({ cwd, files }), linux);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("binary newline bytes are never normalized", () => {
  const cwd = mkdtempSync(join(tmpdir(), "vii-binary-id-"));
  try {
    mkdirSync(join(cwd, "public"));
    const files = ["public/image.bin"];
    writeFileSync(join(cwd, files[0]), Buffer.from([0, 255, 13, 10]));
    const original = releaseBuildIdentity({ cwd, files });
    writeFileSync(join(cwd, files[0]), Buffer.from([0, 255, 10]));
    assert.notEqual(releaseBuildIdentity({ cwd, files }), original);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
