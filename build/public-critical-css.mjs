import fs from 'node:fs';
import { createRequire } from 'node:module';

const postcss = createRequire(import.meta.resolve('vite'))('postcss');
const captures = JSON.parse(fs.readFileSync(new URL('../app/styles/public-critical-selectors.json', import.meta.url), 'utf8'));
// CSSOM serializes whitespace and attribute quotes differently from minified CSS.
// Compare complete selector lists, then retain the original source and ordering.
export function selectorKey(value) {
  return value.replace(/\s+/g, ' ').replace(/\s*([,>+~])\s*/g, '$1').replace(/\[([^\]=]+)=["']([^"']+)["']\]/g, '[$1=$2]').trim();
}
const selected = new Set(captures.selectors.map(selectorKey));

export function criticalCssProjection(source) {
  const root = postcss.parse(source);
  root.walkRules(rule => {
    // Every keyframe is retained, including ones referenced by a hidden picker.
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
      parent = parent.parent;
    }
    const sharedInteraction = /\.(?:site-header|mobile-menu|search-|modern-select|sr-only|cookie-|locale-|language-|event-calendar|vacation-party|spa-calendar)/.test(rule.selector);
    // A hidden element cannot be selected by a visible-viewport capture. Its
    // hiding rule is nevertheless critical: omitting it reveals closed drawers
    // and shifts every following section before the complete stylesheet loads.
    const layoutSuppression = rule.nodes.some(node => node.type === 'decl' && (
      (node.prop === 'display' && /\bnone\b/.test(node.value)) ||
      (node.prop === 'visibility' && /hidden|collapse/.test(node.value)) ||
      (node.prop === 'content-visibility')
    ));
    if (!selected.has(selectorKey(rule.selector)) && !sharedInteraction && !layoutSuppression) rule.remove();
  });
  root.walkAtRules(rule => {
    if (rule.nodes && rule.nodes.length === 0) rule.remove();
  });
  // Generated CSS is embedded inside a style resource, never executable markup.
  return root.toString().replace(/<\/style/gi, '<\\/style');
}
