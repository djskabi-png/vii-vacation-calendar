import { rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { deploymentMediaAliases } from "../app/lib/deployment-media-aliases.generated.ts";

const root = process.cwd();
const redundantAssets = [
  "dist/client/platform-architecture-overview.png",
  "dist/client/og-magazine.png",
  "dist/client/og.png",
  "dist/client/vii-calendar-social.png",
  ...Object.keys(deploymentMediaAliases)
    .filter((path) => path.startsWith("/media/"))
    .map((path) => `dist/client${path}`),
];

let removedBytes = 0;

for (const relativePath of redundantAssets) {
  const absolutePath = resolve(root, relativePath);
  try {
    const file = await stat(absolutePath);
    removedBytes += file.size;
    await rm(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(
  `[prune-deployment-assets] removed ${(removedBytes / 1024 / 1024).toFixed(2)} MiB of superseded or byte-identical media`,
);
