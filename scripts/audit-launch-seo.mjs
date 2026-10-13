const origin = process.argv[2] || "https://vii.spaplus.co";
const limit = Number(process.argv[3] || 100);
const sitemap = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(30000) });
if (!sitemap.ok) throw new Error(`sitemap_${sitemap.status}`);
const xml = await sitemap.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1].replaceAll("&amp;", "&"))
  .filter((url) => url.startsWith(origin));
const unique = [...new Set(urls)];
const selected = [...new Set(Array.from({ length: Math.min(limit, unique.length) }, (_, i) =>
  unique[Math.floor(i * unique.length / Math.min(limit, unique.length))]))];
const failures = [];
let checked = 0;
for (let i = 0; i < selected.length; i += 8) {
  await Promise.all(selected.slice(i, i + 8).map(async (url) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "manual" });
      const html = await response.text();
      const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
      const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
      const expected = new URL(url);
      if (expected.pathname !== "/") expected.pathname = expected.pathname.replace(/\/$/, "");
      if (response.status !== 200 || !title || canonical !== expected.href) {
        failures.push({ url, status: response.status, title: Boolean(title), canonical });
      }
      checked++;
    } catch (error) {
      failures.push({ url, error: String(error) });
    }
  }));
}
console.log(JSON.stringify({ sitemapUrls: unique.length, checked, failures }, null, 2));
if (failures.length) process.exitCode = 1;
