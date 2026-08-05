import { magazineArticles } from "../data/magazine-data";
import { SITE_URL, articlePublishedDate } from "../lib/seo";

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function GET() {
  const items = magazineArticles.map((article) => `
    <item>
      <title>${xml(article.title)}</title>
      <link>${SITE_URL}/guides/${article.slug}/</link>
      <guid isPermaLink="true">${SITE_URL}/guides/${article.slug}/</guid>
      <description>${xml(article.excerpt)}</description>
      <pubDate>${new Date(`${articlePublishedDate(article.dateLabel)}T09:00:00+03:00`).toUTCString()}</pubDate>
    </item>`).join("");

  const body = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>מגזין וי פור ויקיישן</title>
    <link>${SITE_URL}/guides/</link>
    <description>מדריכים לבחירת נופש, אירועים, יעדים וטיולים בישראל.</description>
    <language>he-IL</language>
    ${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
