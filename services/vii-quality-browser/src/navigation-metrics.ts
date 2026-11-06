export type NavigationMetrics = {
  ttfbMs: number | null;
  responseEndMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  fcpMs: number | null;
};

type MetricsPage = { evaluate<T>(pageFunction: () => T): Promise<T> };

/** Read-only browser timing snapshot. It never waits, reloads or exposes page data. */
export async function readNavigationMetrics(page: MetricsPage): Promise<NavigationMetrics | undefined> {
  try { return await page.evaluate(() => {
    if(typeof performance==='undefined'||typeof performance.getEntriesByType!=='function')return undefined;
    const entries = performance.getEntriesByType('navigation');
    const navigation = entries[0] as PerformanceNavigationTiming | undefined;
    if (!navigation||!Number.isFinite(navigation.startTime)||navigation.startTime<0||navigation.startTime>180_000) return undefined;
    const relative = (value: number | undefined) => value === undefined || value === 0 ? null : Number.isFinite(value) && value>=navigation.startTime&&value-navigation.startTime<=180_000?Math.round(value-navigation.startTime):NaN;
    const ttfb = relative(navigation.responseStart);
    const responseEnd = relative(navigation.responseEnd);
    const domInteractive = relative(navigation.domInteractive);
    const domContentLoaded = relative(navigation.domContentLoadedEventEnd);
    const paints = performance.getEntriesByType('paint');
    const fcpEntry = paints.find(entry => entry.name === 'first-contentful-paint') as PerformancePaintTiming | undefined;
    const fcp = fcpEntry ? relative(fcpEntry.startTime) : null;
    const values = [ttfb, responseEnd, domInteractive, domContentLoaded, fcp];
    if (values.some(value => Number.isNaN(value))||values.every(value=>value===null)) return undefined;
    return { ttfbMs: ttfb, responseEndMs: responseEnd, domInteractiveMs: domInteractive, domContentLoadedMs: domContentLoaded, fcpMs: fcp };
  }); }catch{return undefined;}
}
