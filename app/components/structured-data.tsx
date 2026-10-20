type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export function StructuredData({ data }: { data: JsonLdValue }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  // The edge localizes JSON-LD after React renders it. Preserve that localized
  // payload during hydration instead of treating the intentional transform as
  // a client/server mismatch.
  return <script suppressHydrationWarning type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
