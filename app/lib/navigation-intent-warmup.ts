/** Speculation is bounded and never retries a failed or expired job automatically. */
export function createNavigationIntentWarmup(options: {
  prefetch: (href: string) => void;
  document: (href: string, signal: AbortSignal) => Promise<unknown>;
  now?: () => number;
  timeoutMs?: number;
}) {
  const seen = new Map<string, number>();
  const queued: string[] = [];
  const active = new Set<AbortController>();
  const now = options.now ?? Date.now;
  let disposed = false;
  const pump = () => {
    while (!disposed && active.size < 1 && queued.length) {
      const href = queued.shift()!;
      const controller = new AbortController();
      active.add(controller);
      const deadline = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
      // Await even a non-cooperative fetch only until the deadline. A late
      // failure is consumed and cannot restart a queued request after disposal.
      const cancelled = new Promise<void>(resolve => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
      void Promise.race([Promise.resolve().then(() => options.document(href, controller.signal)).catch(() => undefined), cancelled])
        .finally(() => { clearTimeout(deadline); active.delete(controller); pump(); });
    }
  };
  return {
    warm(href: string, documentOnly: boolean) {
      if (disposed) return;
      const previous = seen.get(href);
      if (previous !== undefined && now() - previous < 60_000) return;
      if (documentOnly && (queued.length || active.size)) return;
      seen.delete(href);
      seen.set(href, now());
      while (seen.size > 32) seen.delete(seen.keys().next().value!);
      if (documentOnly) { queued.push(href); pump(); }
      else options.prefetch(href);
    },
    cancel(href: string) {
      const index = queued.indexOf(href);
      if (index >= 0) queued.splice(index, 1);
      for (const controller of active) controller.abort();
    },
    dispose() {
      disposed = true;
      queued.length = 0;
      for (const controller of active) controller.abort();
    },
  };
}

export async function warmNavigationDocument(href: string, signal: AbortSignal) {
  const response = await fetch(href, { method: "GET", credentials: "same-origin", cache: "force-cache",
    headers: { Accept: "text/html,application/xhtml+xml" }, signal });
  const reader = response.body?.getReader();
  if (!reader) return;
  let bytes = 0;
  try {
    while (!signal.aborted) {
      const next = await reader.read();
      if (next.done) return;
      bytes += next.value.byteLength;
      if (bytes > 2 * 1024 * 1024) return;
    }
  } finally { await reader.cancel().catch(() => undefined); }
}
