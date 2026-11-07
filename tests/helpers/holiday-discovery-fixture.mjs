import fs from 'node:fs';
import ts from 'typescript';
import { holidayDiscoveryKey, HOLIDAY_DISCOVERY_POLICY } from '../../app/lib/warm-holiday-discovery-cache.ts';

// Execute the actual shared wrapper with a fake durable cache boundary. Route
// tests can still prove a cache hit never calls its catalog/supplier loader.
export function holidayDiscoveryFixture(cachedDiscovery) {
  const source = fs.readFileSync(new URL('../../app/lib/warm-holiday-discovery-cache.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export function cachedHolidayDiscovery');
  const end = source.indexOf('\nexport function holidayWarmSelections', start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('cachedDiscovery', 'holidayDiscoveryKey', 'HOLIDAY_DISCOVERY_POLICY', 'exports', code)(cachedDiscovery, holidayDiscoveryKey, HOLIDAY_DISCOVERY_POLICY, exports);
  return exports.cachedHolidayDiscovery;
}
