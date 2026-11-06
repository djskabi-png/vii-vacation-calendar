import { createExperienceBuffer } from './experience-buffer';
import { experienceRouteContext } from './experience-route-context';
import { EXPERIENCE_STAGE_EVENT } from './experience-signals';
import { NAVIGATION_START_EVENT } from './navigation-recovery';
import type { ExperienceContext, ExperienceMetric, ExperienceStatus } from '../../shared/experience-metrics.ts';

declare const __VII_CACHE_BUILD_ID__: string;
type Pending = { key: string; metric: ExperienceMetric; scope: string; at: number; context: ExperienceContext; timer: ReturnType<typeof setTimeout> };
let runtime: ReturnType<typeof createRuntime> | undefined;
export function experienceRuntime() { return runtime ??= createRuntime(); }

function createRuntime() {
  const buffer = createExperienceBuffer({ now: () => performance.now(), uuid: () => crypto.randomUUID(), send: (body, signal) => fetch('/api/experience/metrics', { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }) });
  let active = false, observing = false, epoch = 0, sequence = 0;
  let interval: ReturnType<typeof setInterval> | undefined;
  let policyRequest: AbortController | undefined;
  let policyAttempts = 0;
  const sampleDraw = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const pending = new Map<string, Pending>();
  const eligible = () => { try { return localStorage.getItem('vii-cookie-choice') === 'all' && !navigator.webdriver && !/bot|playwright|qqqaaa|automation/i.test(navigator.userAgent) && experienceRouteContext(location.href) !== null; } catch { return false; } };
  const context = (href = location.href): ExperienceContext | null => {
    const route = experienceRouteContext(href);
    if (!route) return null;
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    return { ...route, device: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop', network: ['slow-2g','2g','3g','4g'].includes(connection || '') ? connection as ExperienceContext['network'] : 'unknown', cache: 'unknown' };
  };
  const finish = (metric: ExperienceMetric, status: ExperienceStatus = 'measured', scope = '') => {
    const pendingKey = `${metric}:${scope}`;
    const item = pending.get(pendingKey);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(pendingKey);
    if (!active || !eligible()) return;
    buffer.record(item.key, metric, status, status === 'cancelled' ? null : Math.min(120000, Math.max(0, Math.round(performance.now() - item.at))), item.context);
  };
  const begin = (metric: ExperienceMetric, href?: string, scope = '') => {
    if (!active || !eligible() || document.visibilityState !== 'visible') return;
    const route = context(href); if (!route) return;
    finish(metric, 'cancelled', scope);
    if (pending.size >= 16) return;
    const item = { key: `${metric}:${++sequence}`, metric, scope, at: performance.now(), context: route, timer: setTimeout(() => finish(metric, 'timeout', scope), 15000) };
    pending.set(`${metric}:${scope}`, item);
  };
  const navigation = (href: string) => {
    try { const target = new URL(href, location.href); if (target.origin !== location.origin || target.pathname + target.search === location.pathname + location.search || pending.has('navigation_commit:') && performance.now() - pending.get('navigation_commit:')!.at < 100) return; begin('navigation_commit', target.href); if (experienceRouteContext(target.href)?.routeKind === 'results') begin('results_ready', target.href); } catch { /* Ignore malformed local hints. */ }
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (link && link.target !== '_blank' && !link.hasAttribute('download')) navigation(link.href);
  };
  const transition = (event: Event) => { const href = (event as CustomEvent<{ href?: unknown }>).detail?.href; if (typeof href === 'string') navigation(href); };
  const stage = (event: Event) => {
    const detail = (event as CustomEvent<{ metric?: unknown; phase?: unknown; scope?: unknown }>).detail;
    if (detail?.metric === 'results_ready' && detail.phase === 'ready') { if (document.visibilityState === 'visible') finish('results_ready'); return; }
    if (detail?.metric !== 'map_ready' && detail?.metric !== 'gallery_ready') return;
    const scope = typeof detail.scope === 'string' && detail.scope.length <= 128 ? detail.scope : '';
    if (detail.phase === 'start') begin(detail.metric, undefined, scope);
    else if (detail.phase === 'ready') finish(detail.metric, 'measured', scope);
    else if (detail.phase === 'error' || detail.phase === 'cancelled') finish(detail.metric, detail.phase, scope);
  };
  const error = () => { const c = context(); if (active && eligible() && c) buffer.record(`error:${++sequence}`, 'client_error', 'error', 1, c); };
  const visibility = () => { if (document.visibilityState === 'hidden') { for (const item of [...pending.values()]) finish(item.metric, 'cancelled', item.scope); if (active && eligible()) void buffer.flush(); } };
  const stop = () => {
    active = false; epoch++; policyRequest?.abort(); policyRequest = undefined; buffer.revoke();
    if (interval) clearInterval(interval); interval = undefined;
    for (const item of pending.values()) clearTimeout(item.timer); pending.clear();
  };
  async function refresh() {
    if (!eligible()) { stop(); return; }
    if (active || policyRequest || policyAttempts >= 2) return;
    policyAttempts++;
    const ownEpoch = ++epoch;
    const controller = new AbortController(); policyRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch('/api/experience/policy', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) return;
      const policy = await response.json();
      if (ownEpoch !== epoch || !eligible() || policy.enabled !== true || typeof __VII_CACHE_BUILD_ID__ !== 'string' || policy.buildId !== __VII_CACHE_BUILD_ID__ || !Number.isSafeInteger(policy.serverTime) || !Number.isInteger(policy.sampleRateBps) || policy.sampleRateBps < 1 || policy.sampleRateBps > 1000) return;
      if (sampleDraw >= policy.sampleRateBps / 10000) return;
      active = true; buffer.grant(policy);
      interval = setInterval(() => { if (eligible()) void buffer.flush(); else stop(); }, 10000);
      if (!observing) {
        const initial = context();
        const vitals = await import('web-vitals');
        if (!initial || ownEpoch !== epoch || !active || !eligible() || observing) return;
        observing = true;
        const supported = typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes;
        for (const [metric, entryType] of [['lcp','largest-contentful-paint'],['inp','event'],['cls','layout-shift'],['ttfb','navigation']] as const) {
          if (!supported.includes(entryType)) buffer.record(`unsupported:${metric}`, metric, 'unsupported', null, initial);
        }
        const report = (metric: import('web-vitals').Metric) => {
          if (!active || !eligible()) return;
          const name = metric.name.toLowerCase() as ExperienceMetric;
          buffer.record(`vital:${metric.id}`, name, 'measured', Math.max(0, Math.min(name === 'cls' ? 10000 : 120000, Math.round(metric.value * (name === 'cls' ? 1000 : 1)))), initial);
        };
        vitals.onLCP(report); vitals.onINP(report); vitals.onCLS(report); vitals.onTTFB(report);
      }
    } catch { /* Measurement must never affect navigation or page rendering. */ }
    finally { clearTimeout(timeout); if (policyRequest === controller) policyRequest = undefined; }
  }
  let attached = false;
  return {
    start() {
      if (attached) return; attached = true;
      document.addEventListener('click', click, true); document.addEventListener('visibilitychange', visibility);
      window.addEventListener(NAVIGATION_START_EVENT, transition); window.addEventListener(EXPERIENCE_STAGE_EVENT, stage);
      window.addEventListener('error', error); window.addEventListener('unhandledrejection', error);
      window.addEventListener('vii-cookie-choice-changed', refresh);
      void refresh();
    },
    routeCommitted() {
      if (!eligible()) { stop(); return; }
      if (!active) { void refresh(); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { if (document.visibilityState === 'visible') finish('navigation_commit'); }));
    },
    resultsVisible() { if (document.visibilityState === 'visible') finish('results_ready'); },
    stop() {
      attached = false; stop();
      document.removeEventListener('click', click, true); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener(NAVIGATION_START_EVENT, transition); window.removeEventListener(EXPERIENCE_STAGE_EVENT, stage);
      window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', error);
      window.removeEventListener('vii-cookie-choice-changed', refresh);
    },
  };
}
