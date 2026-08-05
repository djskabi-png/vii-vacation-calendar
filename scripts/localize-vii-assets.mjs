import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const appRoot = resolve("app");
const mediaRoot = resolve("public/media");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : /\.(?:ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []));
  return nested.flat();
}

await mkdir(mediaRoot, { recursive: true });
const files = await sourceFiles(appRoot);
const urlPattern = /https:\/\/www\.vii\.co\.il\/[^"'`\s)]+/g;
const replacements = new Map();

for (const file of files) {
  let source = await readFile(file, "utf8");
  source = source.replace(/^\s*liveUrl:\s*"https:\/\/www\.vii\.co\.il\/[^\"]+",?\r?\n/gm, "");
  source = source.replace(/,\s*liveUrl:\s*"https:\/\/www\.vii\.co\.il\/[^\"]+"/g, "");
  for (const url of source.match(urlPattern) || []) {
    if (!replacements.has(url)) {
      const parsed = new URL(url);
      const extension = extname(parsed.pathname).toLowerCase() || ".bin";
      const filename = `${createHash("sha256").update(url).digest("hex").slice(0, 16)}${extension}`;
      const publicPath = `/media/${filename}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed ${response.status}: ${url}`);
      await writeFile(join(mediaRoot, filename), Buffer.from(await response.arrayBuffer()));
      replacements.set(url, publicPath);
    }
    source = source.split(url).join(replacements.get(url));
  }
  await writeFile(file, source, "utf8");
}

console.log(JSON.stringify({ assets: replacements.size, mediaRoot }));
