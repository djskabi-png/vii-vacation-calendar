import fs from 'node:fs';
import path from 'node:path';

export function worldStyleSources(root = process.cwd()) {
  const manifestPath = path.resolve(root, 'app/worlds/style-slots.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.slots) || !manifest.slots.length) throw Error('Invalid world style manifest');
  const files = new Map();
  const fragments = new Map();
  const slots = new Map();
  for (const entry of manifest.slots) {
    if (!['spa','events','hourly','vacations'].includes(entry.world) || typeof entry.file !== 'string' || entry.file.includes('..') || !entry.file.startsWith(`app/worlds/${entry.world}/styles/`)) throw Error('Invalid world style ownership');
    if (slots.has(entry.marker)) throw Error('Duplicate world style slot');
    if (!files.has(entry.file)) {
      const source = fs.readFileSync(path.resolve(root, entry.file), 'utf8');
      files.set(entry.file, source);
      const sections = new Map();
      for (const match of source.matchAll(/\/\* VII_FRAGMENT_BEGIN ([A-Z_0-9]+) \*\/\r?\n([\s\S]*?)\r?\n\/\* VII_FRAGMENT_END \1 \*\//g)) {
        if (sections.has(match[1])) throw Error('Duplicate world style fragment');
        sections.set(match[1], match[2]);
      }
      fragments.set(entry.file, sections);
    }
    const css = entry.fragment ? fragments.get(entry.file).get(entry.fragment) : files.get(entry.file);
    if (!css?.trim()) throw Error(`Missing world style source: ${entry.marker}`);
    slots.set(entry.marker, css);
  }
  return { manifest, manifestPath, files, slots };
}

export function composeWorldStyles(source, sources = worldStyleSources()) {
  const seen = new Set();
  const css = source.replace(/\/\* VII_(?:WORLD_STYLE_[A-Z_0-9]+|SPA_AUDIENCE_DATE_CSS_SLOT) \*\//g, marker => {
    if (!sources.slots.has(marker) || seen.has(marker)) throw Error(`Unknown or duplicate world style slot: ${marker}`);
    seen.add(marker);
    return sources.slots.get(marker);
  });
  if (seen.size !== sources.slots.size) throw Error('Missing world style slots in global cascade');
  return css;
}

export const worldStyleSlotsPlugin = () => ({
  name: 'vii-world-style-slots', enforce: 'pre',
  buildStart() {
    const sources = worldStyleSources();
    composeWorldStyles(fs.readFileSync('app/globals.css','utf8'), sources);
    for (const file of ['app/globals.css', sources.manifestPath, ...sources.files.keys()]) this.addWatchFile(path.resolve(file));
  },
  transform(code, id) {
    if (path.resolve(id.split('?')[0]) !== path.resolve('app/globals.css')) return null;
    return { code: composeWorldStyles(code), map: null };
  },
});
