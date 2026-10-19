// Keep old managed homepage links compatible with the current search contract.
// Do not rewrite other worlds, arbitrary features or explicit pool selections.
export function normalizeHomepageSearchHref(href: string): string {
  if (!/^\/(?:(?:en|fr|ru)\/)?search\/?\?/.test(href)) return href;
  const url = new URL(href, "https://vii.invalid");
  const legacy = url.searchParams.getAll("feature");
  if (legacy.length !== 1 || legacy[0] !== "בריכה") return href;
  url.searchParams.delete("feature");
  if (!url.searchParams.has("pool")) url.searchParams.set("pool", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeHomepageItems<T extends { href: string }>(items: T[]): T[] {
  return items.map((item) => ({ ...item, href: normalizeHomepageSearchHref(item.href) }));
}
