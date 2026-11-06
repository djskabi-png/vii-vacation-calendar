import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This is the managed Site's cache namespace. Independently deployed services
// are deliberately excluded; their artifacts have separate release digests.
const deployRoots = ["app/", "worker/", "build/", "infrastructure/", "scripts/", "public/", "types/"];
const rootInputs = /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vite\.config\.[^/]+|wrangler\.[^/]+|tsconfig[^/]*\.json|postcss\.config\.[^/]+|next\.config\.[^/]+|drizzle\.config\.[^/]+|instrumentation(?:-client)?\.[^/]+|proxy\.[^/]+|\.openai\/hosting\.json)$/;
const textExtensions = /\.(?:css|cjs|html|js|json|mjs|md|mts|ps1|sql|svg|toml|ts|tsx|txt|yaml|yml)$/i;
const included = path => (rootInputs.test(path) || path.startsWith("shared/") || deployRoots.some(root => path.startsWith(root))) &&
  !path.startsWith("scripts/fixtures/") && !/(?:^|\/)(?:test|tests|docs)\//.test(path) && !path.endsWith(".map");

function canonicalBytes(path, bytes) {
  if (!textExtensions.test(path)) return bytes;
  return Buffer.from(bytes.toString("utf8").replace(/\r\n?/g, "\n"), "utf8");
}

/** Managed Site source-input identity, separate from an exact artifact digest. */
export function releaseBuildIdentity({ cwd = process.cwd(), files } = {}) {
  const root = resolve(cwd);
  const paths = (files ?? execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean)).filter(included).sort();
  if (!paths.length) throw new Error("release_source_identity_unavailable");
  const digest = createHash("sha256");
  for (const path of paths) digest.update(path).update("\0").update(canonicalBytes(path, readFileSync(resolve(root, path)))).update("\0");
  const hex = digest.digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

if (process.argv[1] && process.argv[1].endsWith("release-build-identity.mjs")) {
  process.stdout.write(`${releaseBuildIdentity({cwd:process.argv[2] || process.cwd()})}\n`);
}
