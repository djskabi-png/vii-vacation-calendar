// The portable/managed runtime may not expose HTMLRewriter. Do not collect
// the entire streamed page merely to replace one canonical link in its head.
export function rewriteCanonicalStream(response: Response, links: (href: string) => { canonical: string; alternates: string }) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("X-VII-Html-Transform", "streaming-fallback");
  if (!response.body) return new Response(null, { status: response.status, headers });
  const prefix = '<link rel="canonical" href="';
  const decoder = new TextDecoder(); const encoder = new TextEncoder();
  let pending = ""; let replaced = false;
  function process(text: string, controller: TransformStreamDefaultController<Uint8Array>, final = false) {
    pending += text;
    if (replaced) { controller.enqueue(encoder.encode(pending)); pending = ""; return; }
    const start = pending.indexOf(prefix);
    if (start >= 0 && pending.indexOf(">", start) >= 0) {
      pending = pending.replace(/<link rel="canonical" href="([^"]+)"\s*\/?>/, (_tag, href: string) => {
        const output = links(href);
        return `<link rel="canonical" href="${output.canonical}">${output.alternates}`;
      });
      replaced = true;
      controller.enqueue(encoder.encode(pending)); pending = "";
    } else if (final) {
      controller.enqueue(encoder.encode(pending)); pending = "";
    } else if (start < 0 && pending.length >= prefix.length) {
      // Retain only the possible start of a split canonical tag. Everything
      // before it is immediately available to the browser, including the hero.
      controller.enqueue(encoder.encode(pending.slice(0, -(prefix.length - 1))));
      pending = pending.slice(-(prefix.length - 1));
    }
  }
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { process(decoder.decode(chunk, { stream: true }), controller); },
    flush(controller) { process(decoder.decode(), controller, true); },
  }));
  return new Response(stream, { status: response.status, statusText: response.statusText, headers });
}
