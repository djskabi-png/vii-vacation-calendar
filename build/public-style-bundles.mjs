import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { worldStyleSources, composeWorldStyles } from './world-style-slots.mjs';
import { criticalCssProjection } from './public-critical-css.mjs';

export const publicStyleFiles = ['globals.css', 'results-view.css', 'mobile-stability.css', 'app-experience.css', 'site-polish.css', 'mobile-polish.css', 'preview-card-consistency.css', 'slider-card-compact.css', 'direct-phone-link.css', 'pwa.css'];
const worlds = ['vacations', 'events', 'hourly', 'spa'];
const virtualId = 'virtual:vii-public-style-bundles';

/** Keep the original slots and every intervening rule in their original order.
 * Shared search dialogs remain available in every world, including when opened
 * immediately after a navigation. Unknown routes deliberately use the full set.
 */
export function publicStyleBundleSources(root = process.cwd()) {
  const sources = worldStyleSources(root);
  const global = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  composeWorldStyles(global, sources); // Fail closed on a lost/duplicate slot.
  const fonts = fs.readFileSync(path.join(root, 'app/public-fonts.css'), 'utf8');
  const tail = publicStyleFiles.slice(1).map(file => fs.readFileSync(path.join(root, 'app', file), 'utf8')).join('\n');
  const spaDiscoveryCards = fs.readFileSync(path.join(root, 'app/components/spa-package-deals.css'), 'utf8');
  const result = {};
  for (const world of ['all', ...worlds]) {
    const selected = { ...sources, slots: new Map(sources.slots) };
    for (const slot of sources.manifest.slots) {
      const css = sources.slots.get(slot.marker);
      // Date/audience pickers belong to the global search, not only their world.
      const sharedPicker = /\.(?:event-date|event-calendar|event-period|vacation-party|spa-date|spa-calendar|spa-audience|spa-no-date|spa-count|spa-time|spa-no-preference)/.test(css);
      if (world !== 'all' && slot.world !== world && !sharedPicker) selected.slots.set(slot.marker, '');
    }
    result[world] = `${composeWorldStyles(global, selected).replace('@import "./public-fonts.css";', fonts)}\n${tail}${world === 'all' || world === 'spa' ? `\n${spaDiscoveryCards}` : ''}`;
  }
  return result;
}

export function publicStyleBundlesPlugin() {
  let generated;
  async function bundles() {
    if (generated) return generated;
    const require = createRequire(import.meta.resolve('vite'));
    const esbuild = require('esbuild');
    generated = await Promise.all(Object.entries(publicStyleBundleSources()).map(async ([world, source]) => {
      const { code } = await esbuild.transform(source, { loader: 'css', minify: true, legalComments: 'none', target: 'es2022' });
      const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 16);
      return { world, source: code, critical: criticalCssProjection(code), fileName: `assets/vii-public-${world}-${hash}.css` };
    }));
    return generated;
  }
  return {
    name: 'vii-public-style-bundles',
    enforce: 'pre',
    resolveId(id) { if (id === virtualId) return '\0' + virtualId; },
    async load(id) {
      if (id !== '\0' + virtualId) return null;
      const values = await bundles();
      return `export default ${JSON.stringify(Object.fromEntries(values.map(v => [v.world, '/' + v.fileName])))};export const criticalStyles=${JSON.stringify(Object.fromEntries(values.map(v => [v.world, v.critical])))};`;
    },
    async buildStart() {
      if (this.environment?.name !== 'client') return;
      for (const bundle of await bundles()) this.emitFile({ type: 'asset', fileName: bundle.fileName, source: bundle.source });
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!/^\/assets\/vii-public-[a-z]+-[a-f0-9]{16}\.css(?:\?|$)/.test(request.url || '')) return next();
        const found = (await bundles()).find(bundle => '/' + bundle.fileName === request.url.split('?')[0]);
        if (!found) return next();
        response.setHeader('Content-Type', 'text/css; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(found.source);
      });
      server.watcher.on('change', file => {
        if (!file.endsWith('.css') && !file.endsWith('style-slots.json')) return;
        generated = undefined;
        const module = server.moduleGraph.getModuleById('\0' + virtualId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
