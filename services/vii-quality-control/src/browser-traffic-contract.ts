export const browserResourceKinds = ['document','script','stylesheet','image','font','fetch','other'] as const;
export const browserDenialKinds = ['external','budget','write','admin','invalid','platform'] as const;
export const browserWriteKinds = ['cloudflare_challenge','analytics_search','analytics_business','experience_metrics','live_search','server_action','other'] as const;
export type BrowserTraffic = {
  resourceCounts: Record<typeof browserResourceKinds[number],number>;
  deniedCounts: Record<typeof browserDenialKinds[number],number>;
  writeKinds: Array<typeof browserWriteKinds[number]>;
};
export const browserTimingFields=['ttfbMs','responseEndMs','domInteractiveMs','domContentLoadedMs','fcpMs'] as const;
export type BrowserNavigationMetrics=Record<typeof browserTimingFields[number],number|null>;
export function normalizeBrowserNavigationMetrics(value:unknown):BrowserNavigationMetrics|undefined {
  if(value===undefined)return undefined;
  if(!record(value)||Object.keys(value).length!==browserTimingFields.length||browserTimingFields.some(key=>value[key]!==null&&(!Number.isSafeInteger(value[key])||Number(value[key])<0||Number(value[key])>180_000))||browserTimingFields.every(key=>value[key]===null))throw new Error('browser_navigation_metrics_invalid');
  return Object.fromEntries(browserTimingFields.map(key=>[key,value[key]])) as BrowserNavigationMetrics;
}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function normalizeBrowserTraffic(value:unknown,requestCount:number):BrowserTraffic|undefined {
  if(value===undefined)return undefined;
  const invalid=()=>{throw new Error('browser_traffic_invalid');};
  if(!Number.isSafeInteger(requestCount)||requestCount<0||requestCount>1_000_000)return invalid();
  if(!record(value)||Object.keys(value).some(key=>!['resourceCounts','deniedCounts','writeKinds'].includes(key)))return invalid();
  const counts=<T extends readonly string[]>(raw:unknown,keys:T):Record<T[number],number>=>{
    if(!record(raw)||Object.keys(raw).length!==keys.length||keys.some(key=>!Number.isSafeInteger(raw[key])||Number(raw[key])<0||Number(raw[key])>requestCount))return invalid();
    return Object.fromEntries(keys.map(key=>[key,Number(raw[key])])) as Record<T[number],number>;
  };
  const resourceCounts=counts(value.resourceCounts,browserResourceKinds),deniedCounts=counts(value.deniedCounts,browserDenialKinds);
  if(Object.values(resourceCounts).reduce((a,b)=>a+b,0)!==requestCount||Object.values(deniedCounts).reduce((a,b)=>a+b,0)>requestCount)return invalid();
  if(!Array.isArray(value.writeKinds)||value.writeKinds.length>browserWriteKinds.length||new Set(value.writeKinds).size!==value.writeKinds.length||value.writeKinds.some(kind=>!browserWriteKinds.includes(kind))||(deniedCounts.write+deniedCounts.platform===0?value.writeKinds.length!==0:value.writeKinds.length===0)||(deniedCounts.platform>0)!==value.writeKinds.includes('cloudflare_challenge'))return invalid();
  return {resourceCounts,deniedCounts,writeKinds:[...value.writeKinds] as BrowserTraffic['writeKinds']};
}
export function browserObservedResult(result:{reason?:string;requestCount:number;traffic?:BrowserTraffic;navigationMetrics?:BrowserNavigationMetrics}) {
  const base=result.reason==='request_budget_exceeded'?`request_budget_exceeded; request_count=${result.requestCount}`:result.reason??'browser_observed';
  const traffic=normalizeBrowserTraffic(result.traffic,result.requestCount);
  const metrics=normalizeBrowserNavigationMetrics(result.navigationMetrics);
  const observation=traffic?`${base}; requests=${result.requestCount}; resources=${JSON.stringify(traffic.resourceCounts)}; denied=${JSON.stringify(traffic.deniedCounts)}; write_kinds=${traffic.writeKinds.join(',')||'none'}`:base;
  return metrics?`${observation}; navigation_ms=${JSON.stringify(metrics)}`:observation;
}
