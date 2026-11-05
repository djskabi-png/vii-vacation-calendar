export type GrowthEndpointResult<T> = { ok: boolean; status: number | null; value: T | null; error: string | null };

export async function readGrowthEndpoint<T>(fetchImpl: typeof fetch, url: string, kind: "json" | "text", controller: AbortController, timeoutMs = 12_000): Promise<GrowthEndpointResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let phase = "response";
  let abort: (() => void) | undefined;
  try {
    if (controller.signal.aborted) throw new Error("aborted");
    const cancelled = new Promise<never>((_, reject) => { abort = () => reject(new Error("aborted")); controller.signal.addEventListener("abort", abort, { once: true }); });
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error(phase === "body" ? "body_timeout" : "timeout")); controller.abort(); }, timeoutMs); });
    const complete = async (): Promise<GrowthEndpointResult<T>> => {
      const response = await fetchImpl(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return { ok: false, status: response.status, value: null, error: `http_${response.status}` };
      phase = "body";
      const body = await (kind === "json" ? response.json() : response.text());
      return { ok: true, status: response.status, value: body as T, error: null };
    };
    return await Promise.race([complete(), deadline, cancelled]);
  } catch (error) {
    return { ok: false, status: null, value: null, error: error instanceof Error ? error.message : "request_failed" };
  } finally { if (timer) clearTimeout(timer); if (abort) controller.signal.removeEventListener("abort", abort); }
}
