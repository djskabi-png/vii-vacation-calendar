import type { D1Database } from '../../../types/cloudflare-runtime';
import { CLS_BINS, LATENCY_BINS } from '../../../shared/experience-metrics.ts';

type Row = { world: string; route_kind: string; device: string; metric: string; status: string; upper_bound: number; count: number };
type Series = { world: string; routeKind: string; device: string; metric: string; statusCounts: Record<string, number>; numericValueCount: number; unit: 'milliseconds' | 'cls_score_x1000' | 'error_count'; p75UpperBound?: number; p95UpperBound?: number; quantileCaveat?: string };
const worlds = new Set(['vacation','events','spa','hourly','activities','trails','providers','global']);
const metrics = new Set(['lcp','inp','cls','ttfb','navigation_commit','results_ready','map_ready','gallery_ready','client_error']);
const statuses = new Set(['measured','error','timeout','unsupported','cancelled']);

function validRow(row: Row) {
  if (!worlds.has(row.world) || !metrics.has(row.metric) || !statuses.has(row.status) || !['home','world','results','place','editorial'].includes(row.route_kind) || !['mobile','desktop'].includes(row.device) || !Number.isSafeInteger(row.count) || row.count <= 0) return false;
  if (row.metric === 'client_error') return row.status === 'error' && row.upper_bound === -1;
  if (row.status === 'unsupported' || row.status === 'cancelled') return row.upper_bound === -1;
  if (row.upper_bound === -1) return row.status === 'error' || row.status === 'timeout';
  const bins: readonly number[] = row.metric === 'cls' ? CLS_BINS : LATENCY_BINS;
  return bins.includes(row.upper_bound);
}

/** Counts are metric observations, not visits. Quantiles describe sampled,
 * completed server windows and include timed/error durations when observed. */
export async function readExperienceSummary(db: Pick<D1Database, 'prepare'>, input: { buildId: string; sourceVersion: string; now?: number }) {
  const now = input.now ?? Date.now();
  const end = Number.isSafeInteger(now) ? Math.floor(now / 300000) * 300000 : null;
  const metadata = { windowStart: end === null ? null : end - 86400000, windowEnd: end, completedWindowsOnly: true, buildId: input.buildId, sourceVersion: input.sourceVersion, countUnit: 'metric_observations', caveat: 'sampled_not_total_traffic' };
  if (end === null || !/^[0-9a-f]{40}$/.test(input.sourceVersion) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.buildId)) return { ...metadata, state: 'invalid_generation' as const, sampleCount: null, series: [] };
  const result = await db.prepare('SELECT world,route_kind,device,metric,status,upper_bound,SUM(count) AS count FROM quality_experience_bins WHERE window_start>=? AND window_start<? AND build_id=? AND source_version=? AND count>0 GROUP BY world,route_kind,device,metric,status,upper_bound LIMIT 2001').bind(end - 86400000, end, input.buildId, input.sourceVersion).all<Row>();
  const rows = result.results ?? [];
  if (rows.length > 2000) return { ...metadata, state: 'truncated' as const, sampleCount: null, series: [] };
  const groups = new Map<string, { series: Series; values: Array<{ upper: number; count: number }> }>();
  let sampleCount = 0;
  for (const row of rows) {
    if (!validRow(row) || !Number.isSafeInteger(sampleCount + row.count)) return { ...metadata, state: 'invalid_data' as const, sampleCount: null, series: [] };
    sampleCount += row.count;
    const key = JSON.stringify([row.world, row.route_kind, row.device, row.metric]);
    let group = groups.get(key);
    if (!group) {
      group = { series: { world: row.world, routeKind: row.route_kind, device: row.device, metric: row.metric, statusCounts: {}, numericValueCount: 0, unit: row.metric === 'cls' ? 'cls_score_x1000' : row.metric === 'client_error' ? 'error_count' : 'milliseconds' }, values: [] };
      groups.set(key, group);
    }
    group.series.statusCounts[row.status] = (group.series.statusCounts[row.status] || 0) + row.count;
    if (row.upper_bound >= 0) { group.values.push({ upper: row.upper_bound, count: row.count }); group.series.numericValueCount += row.count; }
  }
  for (const { series, values } of groups.values()) {
    if (series.numericValueCount < 20) continue;
    values.sort((a, b) => a.upper - b.upper);
    const quantile = (fraction: number) => {
      const rank = Math.ceil(series.numericValueCount * fraction); let cumulative = 0;
      for (const value of values) { cumulative += value.count; if (cumulative >= rank) return value.upper; }
      return values[values.length - 1].upper;
    };
    series.p75UpperBound = quantile(.75); series.p95UpperBound = quantile(.95);
    series.quantileCaveat = 'histogram_upper_bound_estimates_includes_timeouts_and_errors';
  }
  return { ...metadata, state: sampleCount ? 'ok' as const : 'insufficient_data' as const, sampleCount, series: [...groups.values()].map(group => group.series) };
}
