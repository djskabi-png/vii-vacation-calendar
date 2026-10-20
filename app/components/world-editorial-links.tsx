"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { editorialWorldLinks } from "../data/editorial-world-links";
import { editorialImageCopy } from "../data/editorial-image-copy";
import { useSiteLanguage } from "../i18n/locale-provider";
import type { WorldId } from "../data/world-data";
import { editorialAreaVisible } from "../lib/editorial-viewport";
import { HomeMobileRail } from "./home-mobile-rail";

export function WorldEditorialLinks({ variant }: { variant: WorldId }) {
  const pathname = usePathname().replace(/^\/(en|fr|ru)(?=\/|$)/, "");
  const { language } = useSiteLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const update = () => document.body.toggleAttribute("data-world-editorial-reading",
      editorialAreaVisible(element.getBoundingClientRect(), window.innerHeight));
    const observer = new IntersectionObserver(update, { threshold: 0 });
    observer.observe(element);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.body.removeAttribute("data-world-editorial-reading");
    };
  }, [pathname, language, variant]);
  // Discovery guides belong to worlds and business pages, not legal/account utilities.
  if (language !== "he" || !/^\/(search|vacations|events|corporate|spas|hourly|providers|attractions|trails|business|discover|villas|suite-complexes|vacation-apartments|lofts)(\/|$)/.test(pathname)) return null;
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
  return <section ref={sectionRef} className="section shell world-editorial" aria-labelledby="world-editorial-title">
    <div className="section-head"><h2 id="world-editorial-title">מדריכים שכדאי לקרוא לפני שבוחרים</h2><Link href="/guides">לכל הכתבות</Link></div>
    <HomeMobileRail id="world-editorial-rail" label="מדריכים שכדאי לקרוא לפני שבוחרים" className="world-editorial__grid">{articles.map(article => <article key={article.slug}>
      <Link href={`/guides/${article.slug}`}><img src={article.image} alt={editorialImageCopy[article.slug].he.alt} title={editorialImageCopy[article.slug].he.title} width={768} height={512} loading="lazy" decoding="async" data-no-translate /><h3>{article.title}</h3><p>{article.excerpt}</p><span>לקריאת המדריך</span></Link>
    </article>)}</HomeMobileRail>
  </section>;
}
