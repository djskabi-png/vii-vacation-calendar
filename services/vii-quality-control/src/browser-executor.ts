const browserDiagnosticPaths = new Set(["<redacted>","/api/vii/live-search","/api/experience/metrics","/api/lead","/api/booking","/api/payments","/api/admin/quality"]);
import { browserProfile } from "./browser-profiles.ts";
import { normalizeBrowserTraffic, normalizeBrowserNavigationMetrics, type BrowserTraffic, type BrowserNavigationMetrics } from './browser-traffic-contract.ts';

export const BROWSER_RUN_PATH = "https://vii-quality-browser.internal/run";
export type BrowserBinding = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
export type BrowserExecutionInput = { jobId: string; sourceSha: string; buildId: string; profileId: string; signal?: AbortSignal; browser: BrowserBinding };
export type BrowserDiagnosticWrite = { method: string; origin: string; path: string };
export type BrowserExecutionResult = { jobId: string; sourceVersion: string; buildId: string; profileId: string; status: "passed" | "failed" | "blocked"; reason?: string; requestCount: number; steps: number; evidenceKey?: string; elapsedMs: number; failureStep?: string; attemptedWrites?: BrowserDiagnosticWrite[]; traffic?: BrowserTraffic; navigationMetrics?:BrowserNavigationMetrics };
const maxResponseBytes = 16 * 1024;
const validSha = (v: string) => /^[a-f0-9]{40}$/.test(v);
const validBuild = (v: string) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
async function jsonBody(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new Error("browser_empty_response");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  const cancel=()=>{void reader.cancel().catch(()=>undefined);};
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maxResponseBytes) throw new Error("browser_response_too_large"); chunks.push(part.value); } }
  finally { signal.removeEventListener('abort',cancel);void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function executeBrowserProfile(input: BrowserExecutionInput): Promise<BrowserExecutionResult> {
  const profile = browserProfile(input.profileId);
  if (!profile) throw new Error("browser_profile_unsupported");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(input.jobId) || !validSha(input.sourceSha) || !validBuild(input.buildId)) throw new Error("browser_identity_invalid");
  if (input.signal?.aborted) throw new Error("browser_cancelled");
  const body = JSON.stringify({ jobId: input.jobId, sourceVersion: input.sourceSha, buildId: input.buildId, engineVersion:profile.engineVersion, world: profile.world, device: profile.device, scenario: profile.scenario });
  const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(new Error("browser_deadline_exceeded")), profile.timeoutMs + 5_000);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout.signal]) : timeout.signal;
  let response: Response | undefined;
  let onAbort: (()=>void) | undefined;
  try {
  const operation = (async()=>{
    response = await input.browser.fetch(BROWSER_RUN_PATH, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body, signal });
    if(signal.aborted){void response.body?.cancel().catch(()=>undefined);throw new Error('browser_cancelled');}
    if (!response.ok) {void response.body?.cancel().catch(()=>undefined);throw new Error(`browser_executor_${response.status}`);}
    return jsonBody(response,signal);
  })();
  const raw = await Promise.race([operation,new Promise<never>((_,reject)=>{
    onAbort=()=>{void response?.body?.cancel().catch(()=>undefined);reject(new Error(timeout.signal.aborted?'browser_deadline_exceeded':'browser_cancelled'));};
    signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();
  })]);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("browser_result_invalid");
  const result = raw as Record<string, unknown>;
  const overBudgetFailure=result.status==='failed'&&result.reason==='request_budget_exceeded'&&Number.isSafeInteger(result.requestCount)&&Number(result.requestCount)>profile.maxRequests&&Number(result.requestCount)<=1_000_000;
  if (result.jobId !== input.jobId || result.sourceVersion !== input.sourceSha || result.buildId !== input.buildId || result.engineVersion!==profile.engineVersion || result.world !== profile.world || result.device !== profile.device || result.scenario !== profile.scenario) throw new Error("browser_result_identity_mismatch");
  if (!(["passed", "failed", "blocked"] as unknown[]).includes(result.status) || !Number.isSafeInteger(result.requestCount) || Number(result.requestCount) < 0 || (Number(result.requestCount) > profile.maxRequests && !overBudgetFailure) || !Number.isSafeInteger(result.steps) || Number(result.steps) < 0 || !Number.isSafeInteger(result.durationMs) || Number(result.durationMs) < 0 || Number(result.durationMs) > profile.timeoutMs + 5_000) throw new Error("browser_result_invalid");
  if(result.status==='passed' && (Number(result.steps)<2 || Number(result.requestCount)<1 || result.reason!=null || result.evidenceKey!=null))throw new Error('browser_result_invalid');
  if(result.status!=='passed' && (typeof result.reason!=='string' || !/^[a-z0-9_]{1,160}$/.test(result.reason)))throw new Error('browser_result_invalid');
  if (result.evidenceKey !== undefined && result.evidenceKey!==`qqqaaa/failures/${input.sourceSha}/${input.jobId}/${profile.device}-${profile.scenario}.jpg`) throw new Error("browser_result_invalid");
  if(result.failureStep!==undefined&&!(typeof result.failureStep==='string'&&/^[a-z0-9-]{1,64}$/.test(result.failureStep)))throw new Error('browser_result_invalid');
  if(result.attemptedWrites!==undefined&&!(Array.isArray(result.attemptedWrites)&&result.attemptedWrites.length<=8&&result.attemptedWrites.every(x=>x&&typeof x==='object'&&/^[A-Z]{3,7}$/.test(String((x as Record<string,unknown>).method))&&['https://vii.spaplus.co','https://www.vii.co.il','https://vii-vacation-calendar.adir-naor-7510.chatgpt.site','<external>'].includes(String((x as Record<string,unknown>).origin))&&browserDiagnosticPaths.has(String((x as Record<string,unknown>).path))&& !String((x as Record<string,unknown>).path).includes('?')&&!String((x as Record<string,unknown>).path).includes('#'))))throw new Error('browser_result_invalid');
  const failureStep=typeof result.failureStep==='string'?result.failureStep:undefined;
  const traffic=normalizeBrowserTraffic(result.traffic,Number(result.requestCount));
  const navigationMetrics=normalizeBrowserNavigationMetrics(result.navigationMetrics);
  if(result.status==='passed'&&traffic&&(traffic.deniedCounts.write>0||traffic.deniedCounts.budget>0))throw new Error('browser_result_invalid');
  const attemptedWrites=Array.isArray(result.attemptedWrites)?result.attemptedWrites.map(value=>{
    const entry=value as Record<string,unknown>;
    return {method:entry.method as string,origin:entry.origin as string,path:entry.path as string};
  }):undefined;
  return { jobId: input.jobId, sourceVersion: input.sourceSha, buildId: input.buildId, profileId: input.profileId, status: result.status as BrowserExecutionResult["status"], ...(typeof result.reason === "string" ? { reason: result.reason.slice(0, 160) } : {}), requestCount: Number(result.requestCount), steps: Number(result.steps), ...(typeof result.evidenceKey === "string" ? { evidenceKey: result.evidenceKey } : {}), elapsedMs: Number(result.durationMs), ...(failureStep?{failureStep}:{}), ...(attemptedWrites?{attemptedWrites}: {}), ...(traffic?{traffic}:{}), ...(navigationMetrics?{navigationMetrics}:{}) };
  }finally{clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort);}
}
