import { lstat, readFile, realpath, rm, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

// A partial build must never inherit an earlier SSR asset manifest.
export async function prepareCleanBuild(projectRoot) {
  const root = await realpath(projectRoot);
  await readFile(resolve(root, "package.json"), "utf8");
  const output = resolve(root, "dist");
  if (dirname(output) !== root) throw new Error("Build output must be project/dist");
  let info;
  try { info = await lstat(output); } catch (error) { if (error.code === "ENOENT") return; throw error; }
  if (info.isSymbolicLink() || await realpath(output) !== output) throw new Error("Refusing linked build output");
  if (!info.isDirectory()) throw new Error("Build output is not a directory");
  await rm(output, { recursive: true });
}

export async function verifyRscAssets(projectRoot) {
  const root = resolve(projectRoot, "dist");
  const readManifest = async path => JSON.parse((await readFile(path, "utf8")).replace(/^\s*export default\s+/, "").replace(/;?\s*$/, ""));
  const first = await readManifest(resolve(root, "server/__vite_rsc_assets_manifest.js"));
  const second = await readManifest(resolve(root, "server/ssr/__vite_rsc_assets_manifest.js"));
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("RSC and SSR asset manifests disagree");
  if (!first.bootstrapScriptContent?.includes("/assets/")) throw new Error("Missing browser bootstrap");
  const references = new Set();
  const visit = value => {
    if (typeof value === "string") for (const match of value.matchAll(/\/assets\/[^\s\"'`\\)]+/g)) references.add(match[0]);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(first);
  const client = resolve(root, "client");
  for (const reference of references) {
    const path = resolve(client, "." + decodeURIComponent(reference.split(/[?#]/)[0]));
    if (!path.startsWith(client + sep)) throw new Error("Asset escapes client output");
    try { if (!(await stat(path)).isFile()) throw new Error("Not a file"); }
    catch { throw new Error(`Manifest references missing client asset: ${reference}`); }
  }
  return { manifestsAgree: true, references: references.size, bootstrap: first.bootstrapScriptContent };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes("--clean")) await prepareCleanBuild(process.cwd());
  else console.log(JSON.stringify(await verifyRscAssets(process.cwd())));
}
