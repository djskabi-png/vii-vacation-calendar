// Never accumulate an unbounded clone before checking Content-Length.
// Cancel only this cache branch, never the response streaming to the visitor.
export async function readBoundedCacheBody(body: ReadableStream<Uint8Array> | null,
  maxBytes: number, deadlineMs = 3000): Promise<ArrayBuffer | null> {
  if (!body) return new ArrayBuffer(0);
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const consume = async () => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (!stopped) {
        const next = await reader.read();
        if (stopped) return null;
        if (next.done) {
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          return bytes.buffer;
        }
        size += next.value.byteLength;
        if (size > maxBytes) return null;
        chunks.push(next.value);
      }
      return null;
    } catch { return null; }
    finally { reader.releaseLock(); }
  };
  try {
    return await Promise.race([consume(), new Promise<null>((resolve) => {
      timer = setTimeout(() => { stopped = true; resolve(null); }, deadlineMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    // Tee cancellation may wait for the original browser stream. Do not await it.
    // On an oversize branch consume released its lock, so cancel the body itself.
    stopped = true;
    if (body.locked) void reader.cancel().catch(() => undefined);
    else void body.cancel().catch(() => undefined);
  }
}

let activeCaptures = 0;
let activeWrites = 0;
// If optional storage hangs, stop adding remote writes, but keep local cache
// capture/serving operational. No timeout releases an unresolved remote write.
export function claimPublicCacheWrite(): (() => void) | null {
  if (activeWrites >= 2) return null;
  activeWrites++;
  let released = false;
  return () => { if (!released) { released = true; activeWrites--; } };
}
export function claimPublicCacheCapture(): (() => void) | null {
  if (activeCaptures >= 2) return null;
  activeCaptures++;
  let released = false;
  return () => { if (!released) { released = true; activeCaptures--; } };
}
