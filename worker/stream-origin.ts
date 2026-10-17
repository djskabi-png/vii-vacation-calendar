// Preserve the existing literal origin replacement without waiting for the
// complete HTML/RSC tail. Keep only a possible split match between chunks.
export function rewriteOriginStream(response: Response, from: string, to: string) {
  if (!from) throw new TypeError("origin_replacement_source_required");
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (!response.body) return new Response(null, { status: response.status, statusText: response.statusText, headers });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  function process(text: string, controller: TransformStreamDefaultController<Uint8Array>, final = false) {
    pending += text;
    let match: number;
    while ((match = pending.indexOf(from)) >= 0) {
      controller.enqueue(encoder.encode(pending.slice(0, match) + to));
      pending = pending.slice(match + from.length);
    }
    const keep = final ? 0 : Math.min(from.length - 1, pending.length);
    let safe = pending.length - keep;
    // TextDecoder protects split UTF-8 bytes; retaining a string suffix must
    // also avoid splitting a UTF-16 surrogate pair before re-encoding it.
    if (safe > 0 && safe < pending.length && /[\uD800-\uDBFF]/.test(pending[safe - 1]) && /[\uDC00-\uDFFF]/.test(pending[safe])) safe--;
    if (safe) controller.enqueue(encoder.encode(pending.slice(0, safe)));
    pending = pending.slice(safe);
  }
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { process(decoder.decode(chunk, { stream: true }), controller); },
    flush(controller) { process(decoder.decode(), controller, true); },
  }));
  return new Response(stream, { status: response.status, statusText: response.statusText, headers });
}
