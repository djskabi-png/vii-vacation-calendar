"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { editorialWorldLinks } from "../data/editorial-world-links";
import { editorialImageCopy } from "../data/editorial-image-copy";
import { useSiteLanguage } from "../i18n/locale-provider";
import type { WorldId } from "../data/world-data";

export function WorldEditorialLinks({ variant }: { variant: WorldId }) {
  const pathname = usePathname().replace(/^\/(en|fr|ru)(?=\/|$)/, "");
  const { language } = useSiteLanguage();
  if (language !== "he" || /^\/(guides|admin|platform|account|legal|booking|join|favorites|gift-card)(\/|$)/.test(pathname) || pathname === "/") return null;
  const world = pathname.startsWith("/corporate") ? "corporate"
    : pathname.startsWith("/attractions") ? "attractions"
    : pathname.startsWith("/trails") ? "trails"
    : pathname.startsWith("/spas") ? "spa"
    : pathname.startsWith("/hourly") ? "hourly"
    : pathname.startsWith("/providers") ? "providers"
    : pathname.startsWith("/events") ? "events"
    : variant === "vacation" ? "vacations" : variant === "activities" ? "attractions" : variant;
  const articles = editorialWorldLinks.filter(article => article.world === world).slice(0,3);
  if (!articles.length) return null;
  return <section className="section shell world-editorial" aria-labelledby="world-editorial-title">
    <div className="section-head"><h2 id="world-editorial-title">מדריכים שכדאי לקרוא לפני שבוחרים</h2><Link href="/guides">לכל הכתבות</Link></div>
    <div className="world-editorial__grid">{articles.map(article => <article key={article.slug}>
      <Link href={`/guides/${article.slug}`}><img src={article.image} alt={editorialImageCopy[article.slug].he.alt} title={editorialImageCopy[article.slug].he.title} width={768} height={512} loading="lazy" decoding="async" data-no-translate /><small className="editorial-illustration">תמונת המחשה</small><h3>{article.title}</h3><p>{article.excerpt}</p><span>לקריאת המדריך</span></Link>
    </article>)}</div>
  </section>;
}
