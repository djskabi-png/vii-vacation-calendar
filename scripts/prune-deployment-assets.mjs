import { rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const redundantAssets = [
  "dist/client/platform-architecture-overview.png",
  "dist/client/og-magazine.png",
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
  `[prune-deployment-assets] removed ${(removedBytes / 1024 / 1024).toFixed(2)} MiB of superseded image fallbacks`,
);
