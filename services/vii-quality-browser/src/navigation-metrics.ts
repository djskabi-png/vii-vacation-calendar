export type NavigationMetrics = {
  ttfbMs: number | null;
  responseEndMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  fcpMs: number | null;
};

type MetricsPage = { evaluate<T>(pageFunction: string | (() => T)): Promise<T> };

// A literal script is deliberate: Wrangler's keep-names transform inserts an
// outer __name helper into nested functions serialized by Playwright.
const navigationMetricsScript = `(() => {
  if(typeof performance==='undefined'||typeof performance.getEntriesByType!=='function')return undefined;
  const navigation=performance.getEntriesByType('navigation')[0];
  if(!navigation||!Number.isFinite(navigation.startTime)||navigation.startTime<0||navigation.startTime>180000)return undefined;
  const relative=value=>value===undefined||value===0?null:Number.isFinite(value)&&value>=navigation.startTime&&value-navigation.startTime<=180000?Math.round(value-navigation.startTime):NaN;
  const fcp=performance.getEntriesByType('paint').find(entry=>entry.name==='first-contentful-paint');
  const values=[relative(navigation.responseStart),relative(navigation.responseEnd),relative(navigation.domInteractive),relative(navigation.domContentLoadedEventEnd),fcp?relative(fcp.startTime):null];
  if(values.some(value=>Number.isNaN(value))||values.every(value=>value===null))return undefined;
  return {ttfbMs:values[0],responseEndMs:values[1],domInteractiveMs:values[2],domContentLoadedMs:values[3],fcpMs:values[4]};
})()`;

/** Read-only browser timing snapshot. It never waits, reloads or exposes page data. */
export async function readNavigationMetrics(page: MetricsPage): Promise<NavigationMetrics | undefined> {
  try { return await page.evaluate<NavigationMetrics | undefined>(navigationMetricsScript); }catch{return undefined;}
}
