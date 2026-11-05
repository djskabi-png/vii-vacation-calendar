export type RequestBodyReadOptions = {
  maxBytes?: number;
  deadlineMs?: number;
  signal?: AbortSignal;
};

export class RequestBodyError extends Error {
  readonly status: 400 | 408 | 413;
  constructor(status: 400 | 408 | 413, code: string) {
    super(code);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

export async function readJsonBody<T = unknown>(request: Request, options: RequestBodyReadOptions = {}): Promise<T> {
  const maxBytes = options.maxBytes ?? 8_192;
  const deadlineMs = options.deadlineMs ?? 2_000;
  const signal = options.signal ?? request.signal;
  if (!request.body) throw new RequestBodyError(400, "invalid_job");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1) throw new RequestBodyError(400, "invalid_body_limits");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let cancelled = false;
  let rejectAbort: ((error: RequestBodyError) => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => { cancelled = true; cancelReader(); rejectAbort?.(new RequestBodyError(408, "request_cancelled")); };
  const cancelReader = () => { void reader.cancel().catch(() => undefined); };
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; cancelReader(); reject(new RequestBodyError(408, "request_body_timeout")); }, deadlineMs);
  });
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    while (true) {
      const result = await Promise.race([reader.read(), abortPromise, timeoutPromise]);
      if (timedOut) throw new RequestBodyError(408, "request_body_timeout");
      if (cancelled) throw new RequestBodyError(408, "request_cancelled");
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) { cancelReader(); throw new RequestBodyError(413, "body_too_large"); }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text) as T; } catch { throw new RequestBodyError(400, "invalid_json"); }
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    cancelReader();
    reader.releaseLock();
  }
}
