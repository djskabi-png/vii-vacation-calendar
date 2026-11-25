import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseFragment } from 'parse5';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const corpus = JSON.parse(gunzipSync(readFileSync('project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json.gz')).toString('utf8'));
const { redirects } = read('app/data/legacy-redirect-inventory.json');
const pages = [...read('app/data/legacy-search-page-publications.json').pages, ...read('app/data/legacy-event-search-pages.json')];
const pathOnly = value => value?.split('?')[0];
const normalSource = value => {
  const url = new URL(value, 'https://www.vii.co.il');
  url.searchParams.sort();
  return (url.pathname.toLowerCase().replace(/\/+$/, '') || '/') + url.search;
};
const bySource = new Map();
for (const row of corpus.rows) {
  if (row.status !== 200) continue;
  const key = normalSource(row.sourcePath);
  const prior = bySource.get(key);
  if (!prior || row.faq.length > prior.faq.length) bySource.set(key, row);
}
const redirectBySource = new Map(Object.entries(redirects).map(([source, target]) => [normalSource(source), target]));
const social = new Set(['og:title', 'og:description', 'og:type', 'og:site_name', 'og:image', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'keywords']);
const promoted = new Map();
const managed = new Map();
const text = node => node.value ?? (node.childNodes || []).map(text).join('');
function bodyBlocks(node) {
  if (node.attrs?.some(attr => attr.name === 'class' && /read-more-less/.test(attr.value))) return [];
  if (['h2', 'h3', 'h4', 'p', 'li'].includes(node.tagName)) {
    const value = text(node).replace(/\s+/g, ' ').trim();
    return value ? [(node.tagName.startsWith('h') ? '## ' : node.tagName === 'li' ? '- ' : '') + value] : [];
  }
  return (node.childNodes || []).flatMap(bodyBlocks);
}

for (const page of pages) {
  const normalized = normalSource(page.legacySourcePath);
  const source = bySource.get(normalized);
  const target = pathOnly(redirects[page.legacySourcePath] || redirectBySource.get(normalized));
  if (!source || !target) continue;
  const metadata = Object.fromEntries(source.metadata.flatMap(tag => {
    const name = (tag.property || tag.name).toLowerCase();
    return social.has(name) && tag.content ? [[name, tag.content]] : [];
  }));
  if (target === page.canonicalPath) {
    if (Object.keys(metadata).length) managed.set(target, metadata);
    continue;
  }
  if (!/^\/s\/israel\/\d+$/.test(page.legacySourcePath) || !/^\/[a-z-]+$/.test(target)) continue;
  if (promoted.has(target)) throw new Error(`More than one editorial source for ${target}`);
  const fragment = source.fragments.find(fragment => /section-text/.test(fragment.className));
  const body = fragment?.html ? bodyBlocks(parseFragment(fragment.html)).join('\n\n') : page.body;
  promoted.set(target, {
    source: page.legacySourcePath, previous: page.canonicalPath, title: page.h1,
    metaTitle: source.title, description: source.description || page.metaDescription,
    body: body.replace(/^קרא עוד\s+הצג פחות\s*/u, '').trim(),
    faq: source.faq.length ? source.faq.map(({question, answer}) => ({question, answer})) : page.faq.map(({question, answer}) => ({question, answer: text(parseFragment(answer)).trim()})), metadata,
  });
}
const sort = map => Object.fromEntries([...map].sort(([left], [right]) => left.localeCompare(right, 'en')));
const fields = [...social];
const values = new Map();
const packed = new Map();
for (const [path, tags] of Object.entries(sort(managed))) {
  packed.set(path, fields.map(field => {
    const value = tags[field];
    if (!value) return -1;
    if (!values.has(value)) values.set(value, values.size);
    return values.get(value);
  }));
}
writeFileSync('app/data/legacy-landing-editorial.generated.json', JSON.stringify({ promoted: sort(promoted), fields, values: [...values.keys()], managed: Object.fromEntries(packed) }) + '\n');
console.log(JSON.stringify({promoted: promoted.size, managed: managed.size}));
