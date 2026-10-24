// The portable/managed runtime may not expose HTMLRewriter. Buffer only the
// document head so canonical and hreflang can be normalized as one atomic set;
// the page body continues streaming without being collected.
export function rewriteCanonicalStream(response: Response, links: (href: string) => { canonical: string; alternates: string }) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("X-VII-Html-Transform", "streaming-fallback");
  if (!response.body) return new Response(null, { status: response.status, headers });
  const decoder = new TextDecoder(); const encoder = new TextEncoder();
  let pending = ""; let headComplete = false;
  const normalizeHead = (value: string) => {
    const withoutAlternates = value.replace(/<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhreflang=)[^>]*>/gi, "");
    return withoutAlternates.replace(/<link rel="canonical" href="([^"]+)"\s*\/?>/, (_tag, href: string) => {
      const output = links(href);
      return `<link rel="canonical" href="${output.canonical}">${output.alternates}`;
    });
  };
  function process(text: string, controller: TransformStreamDefaultController<Uint8Array>, final = false) {
    pending += text;
    if (headComplete) { controller.enqueue(encoder.encode(pending)); pending = ""; return; }
    const headEnd = pending.toLowerCase().indexOf("</head>");
    if (headEnd >= 0) {
      const boundary = headEnd + "</head>".length;
      controller.enqueue(encoder.encode(normalizeHead(pending.slice(0, boundary))));
      const body = pending.slice(boundary);
      if (body) controller.enqueue(encoder.encode(body));
      pending = "";
      headComplete = true;
    } else if (final) {
      controller.enqueue(encoder.encode(normalizeHead(pending)));
      pending = "";
    }
  }
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { process(decoder.decode(chunk, { stream: true }), controller); },
    flush(controller) { process(decoder.decode(), controller, true); },
  }));
  return new Response(stream, { status: response.status, statusText: response.statusText, headers });
}
