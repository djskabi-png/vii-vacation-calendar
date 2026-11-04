import { readdir, readFile, rm, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deploymentMediaAliases } from "../app/lib/deployment-media-aliases.generated.ts";

const sourceExtensions = new Set([".css", ".js", ".json", ".jsx", ".mjs", ".ts", ".tsx"]);
const verifiedMediaPrefix = "/media/verified/";
export const maxSitesOutputBytes = 220 * 1024 * 1024;

async function filesUnder(directory, filter = () => true) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(filename, filter));
    else if (entry.isFile() && filter(filename)) files.push(filename);
  }
  return files;
}

function normalizePublicPath(path) {
  return path.replaceAll("\\", "/").split(/[?#]/, 1)[0];
}

export async function collectVerifiedMediaReferences(projectRoot) {
  const references = new Set();
  const runtimeRoots = ["app", "worker", "build"].map((directory) => resolve(projectRoot, directory));
  for (const runtimeRoot of runtimeRoots) {
    const sources = await filesUnder(runtimeRoot, (filename) => sourceExtensions.has(extname(filename).toLowerCase()));
    for (const filename of sources) {
      const source = await readFile(filename, "utf8");
      if (/\/media\/verified\/(?:["'`]\s*\+|\$\{)/.test(source)) {
        throw new Error(`Dynamic verified-media path is not safe to prune: ${relative(projectRoot, filename)}`);
      }
      for (const match of source.matchAll(/\/media\/verified\/[^"'`\s?#)>,}]+/g)) {
        const reference = normalizePublicPath(match[0]);
        if (reference === verifiedMediaPrefix || reference.includes("${")) {
          throw new Error(`Dynamic verified-media path is not safe to prune: ${relative(projectRoot, filename)}`);
        }
        references.add(reference);
      }
    }
  }
  return references;
}

async function pathExists(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function resolveAlias(publicPath) {
  const seen = new Set();
  let resolved = publicPath;
  while (deploymentMediaAliases[resolved]) {
    if (seen.has(resolved)) throw new Error(`Media alias cycle detected at ${resolved}`);
    seen.add(resolved);
    resolved = deploymentMediaAliases[resolved];
  }
  return resolved;
}

export async function pruneUnreferencedVerifiedMedia(projectRoot) {
  const clientRoot = resolve(projectRoot, "dist/client");
  const verifiedRoot = resolve(clientRoot, "media/verified");
  const references = await collectVerifiedMediaReferences(projectRoot);
  const aliasTargets = new Set(
    Object.values(deploymentMediaAliases)
      .map(normalizePublicPath)
      .filter((path) => path.startsWith(verifiedMediaPrefix)),
  );
  const keep = new Set([...references, ...aliasTargets]);
  const files = await filesUnder(verifiedRoot);
  const removed = [];

  for (const filename of files) {
    const publicPath = `/${relative(clientRoot, filename).replaceAll("\\", "/")}`;
    if (keep.has(publicPath)) continue;
    const file = await stat(filename);
    await rm(filename);
    removed.push({ path: publicPath, bytes: file.size });
  }

  const unresolved = [];
  for (const reference of references) {
    const resolvedReference = resolveAlias(reference);
    if (!await pathExists(resolve(clientRoot, resolvedReference.slice(1)))) {
      unresolved.push(`${reference} -> ${resolvedReference}`);
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`Referenced verified media is missing after pruning:\n${unresolved.join("\n")}`);
  }

  return { references, removed };
}

export async function directorySize(directory) {
  let bytes = 0;
  for (const filename of await filesUnder(directory)) bytes += (await stat(filename)).size;
  return bytes;
}

export async function pruneDeploymentAssets(projectRoot, options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? maxSitesOutputBytes;
  const redundantAssets = [
    "dist/client/platform-architecture-overview.png",
    "dist/client/og-magazine.png",
    "dist/client/og.png",
    "dist/client/vii-calendar-social.png",
    ...Object.keys(deploymentMediaAliases)
      .filter((path) => path.startsWith("/media/"))
      .map((path) => `dist/client${path}`),
  ];

  let removedDuplicateBytes = 0;
  for (const relativePath of redundantAssets) {
    const absolutePath = resolve(projectRoot, relativePath);
    try {
      const file = await stat(absolutePath);
      removedDuplicateBytes += file.size;
      await rm(absolutePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const verified = await pruneUnreferencedVerifiedMedia(projectRoot);
  const removedUnreferencedBytes = verified.removed.reduce((sum, file) => sum + file.bytes, 0);
  const outputBytes = await directorySize(resolve(projectRoot, "dist"));
  if (outputBytes > maxOutputBytes) {
    throw new Error(
      `Sites output is ${(outputBytes / 1024 / 1024).toFixed(2)} MiB, above the ${(maxOutputBytes / 1024 / 1024).toFixed(2)} MiB release budget`,
    );
  }

  return {
    removedDuplicateBytes,
    removedUnreferencedBytes,
    removedUnreferencedFiles: verified.removed.length,
    referencedVerifiedFiles: verified.references.size,
    outputBytes,
    maxOutputBytes,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await pruneDeploymentAssets(process.cwd());
  console.log(
    `[prune-deployment-assets] removed ${(result.removedDuplicateBytes / 1024 / 1024).toFixed(2)} MiB of duplicates and ${(result.removedUnreferencedBytes / 1024 / 1024).toFixed(2)} MiB across ${result.removedUnreferencedFiles} unreachable verified-media files; final output ${(result.outputBytes / 1024 / 1024).toFixed(2)} MiB`,
  );
}
