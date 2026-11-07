import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { withServerRequestReads, readOnceInServerRequest } from '../app/lib/server-request-reads.ts';

test('actual catalog readers share metadata/page SQL only within one request and reread a changed generation', async () => {
  let generation = 1;
  const calls = { state: 0, summaries: 0, overlays: 0, detail: 0 };
  const db = {};
  const source = fs.readFileSync('app/lib/public-catalog-read.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const empty = new Proxy({}, { get: () => () => undefined });
  const require = name => {
    if (name.includes('server-request-reads')) return { readOnceInServerRequest };
    if (name.includes('published-supplier-ids')) return { runtimeCatalogDatabase: async () => db };
    if (name.includes('runtime-database')) return { publicCatalogDatabase: async () => ({ database: db }) };
    if (name.includes('supplier-catalog-store')) return {
      readSupplierCatalogState: async () => { calls.state++; return { activeRunId: `run-${generation}`, activeCount: 1 }; },
      readSupplierCatalogSummaries: async () => { calls.summaries++; return { entries: [{ summary: { supplierId: 7, name: `Name ${generation}`, description: 'Description', location: 'North', area: 'North' } }] }; },
      readSupplierCatalogEntry: async () => { calls.detail++; return { detail: { supplierId: 7, name: `Name ${generation}`, _viiCatalog: { checkedAt: new Date(Date.now() - 1000).toISOString(), attemptedAt: new Date().toISOString() } } }; },
    };
    if (name.includes('content-studio')) return { readPublishedItems: async () => { calls.overlays++; return []; } };
    if (name.includes('public-catalog-policy')) return { publicCatalogEntryAllowed: () => true };
    if (name.includes('sergey-public-catalog-projection')) return { projectSergeyPublicCatalogValue: value => value };
    if (name.includes('supplier-display-text')) return { supplierDisplayDescription: value => value.description };
    return empty;
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  const read = module.exports;
  async function request(expected) {
    await withServerRequestReads(async () => {
      const [metadata, page, detailMetadata, detailPage] = await Promise.all([
        read.publicCatalogSummaries('events'), read.publicCatalogSummaries('events'),
        read.publicCatalogDetail('events', 7), read.publicCatalogDetail('events', 7),
      ]);
      assert.strictEqual(page, metadata);
      assert.strictEqual(detailPage, detailMetadata);
      assert.equal(page[0].name, expected);
      assert.equal(detailPage.name, expected);
    });
  }
  await request('Name 1');
  assert.deepEqual(calls, { state: 1, summaries: 1, overlays: 1, detail: 1 });
  generation = 2;
  await request('Name 2');
  assert.deepEqual(calls, { state: 2, summaries: 2, overlays: 2, detail: 2 });
});
