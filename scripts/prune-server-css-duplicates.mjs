import { readFile, readdir, rm } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";

// Workers serve static styles from dist/client via ASSETS. Vite also emits
// byte-identical copies beside its server bundles; those copies are not served.
// Preserve manifests, JS, media, and every CSS file without an identical client copy.
export async function pruneDuplicateServerCss(projectRoot) {
  const server = resolve(projectRoot, "dist/server");
  const client = resolve(projectRoot, "dist/client");
  const config = JSON.parse(await readFile(resolve(server, "wrangler.json"), "utf8"));
  if (resolve(server, config.assets?.directory || "") !== client) {
    throw new Error("CSS pruning requires the Worker ASSETS directory to be dist/client");
  }
  const removed = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filename);
      } else if (entry.isFile() && entry.name.endsWith(".css")) {
        const serverRelative = relative(server, filename).replaceAll("\\", "/");
        const assetRelative = serverRelative.startsWith("ssr/") ? serverRelative.slice(4) : serverRelative;
        if (!assetRelative.startsWith("assets/")) continue;
        let publicBytes;
        try {
          publicBytes = await readFile(resolve(client, assetRelative));
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        const serverBytes = await readFile(filename);
        if (!serverBytes.equals(publicBytes)) continue;
        await rm(filename);
        removed.push({ path: relative(projectRoot, filename), bytes: serverBytes.length });
      }
    }
  }
  await visit(server);
  return removed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const removed = await pruneDuplicateServerCss(process.cwd());
  console.log(JSON.stringify({ removedDuplicateServerCss: removed, savedBytes: removed.reduce((sum, file) => sum + file.bytes, 0) }));
}
