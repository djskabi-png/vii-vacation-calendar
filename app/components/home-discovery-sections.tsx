"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";
import { defaultHomepagePresentation, type HomeDiscoveryItem } from "../lib/homepage-presentation";
import { HomeSliderControls } from "./home-slider-controls";

type Presentation = {
  popular: HomeDiscoveryItem[];
  cities: HomeDiscoveryItem[];
  types: HomeDiscoveryItem[];
  editorialTitle: string;
  editorialBody: string;
};

function usePresentation() {
  const { language } = useSiteLanguage();
  const [presentation, setPresentation] = useState<Presentation>(defaultHomepagePresentation);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/vii/homepage-presentation?locale=${language}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("presentation_unavailable")))
      .then((value: Presentation) => setPresentation(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [language]);
  return presentation;
}

function DiscoveryRail({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: HomeDiscoveryItem[] }) {
  if (!items.length) return null;
  return <section className="home-managed-discovery" aria-labelledby={`${id}-title`}>
    <div className="home-managed-discovery__head"><div><span>{eyebrow}</span><h3 id={`${id}-title`}>{title}</h3></div><HomeSliderControls railId={`${id}-track`} label={title} itemSelector=":scope > a" /></div>
    <nav id={`${id}-track`} className="home-managed-discovery__track search-depth__rail" data-horizontal-rail aria-label={title}>{items.map((item) => <Link className="search-depth__discovery-card" key={item.id} href={item.href} prefetch={false} data-global-feedback="true" data-loading-label={`פותחים ${item.label}...`}>
      <span className="search-depth__discovery-icon home-managed-discovery__visual"><img src={item.image} alt={item.imageAlt || ""} title={item.imageAlt} loading="lazy" decoding="async" /></span>
      <strong>{item.label}</strong>
      {item.note ? <small>{item.note}</small> : <small>לצפייה בתוצאות</small>}
      <span className="search-depth__discovery-arrow" aria-hidden="true">←</span>
    </Link>)}</nav>
  </section>;
}

export function HomeQuickSearches() {
  const presentation = usePresentation();
  return <section className="home-visual-searches" aria-labelledby="home-popular-searches-title"><div className="home-visual-searches__head"><Search aria-hidden="true" /><div><span>קיצורי דרך</span><h2 id="home-popular-searches-title">חיפושים פופולריים</h2></div></div><div>{presentation.popular.map((item) => <Link key={item.id} href={item.href} prefetch={false} data-global-feedback="true" data-loading-label={`מחפשים ${item.label}...`}><img src={item.image} alt={item.imageAlt || ""} title={item.imageAlt} /><span><strong>{item.label}</strong><small>{item.note}</small></span></Link>)}</div></section>;
}

export function HomeManagedDiscovery() {
  const presentation = usePresentation();
  return <div className="home-managed-discovery-wrap">
    <DiscoveryRail id="home-popular-rail" eyebrow="מה מחפשים עכשיו" title="חיפושים פופולריים" items={presentation.popular} />
    <DiscoveryRail id="home-city-rail" eyebrow="לפי יעד" title="חיפוש לפי עיר ואזור" items={presentation.cities} />
    <DiscoveryRail id="home-type-rail" eyebrow="לפי סגנון האירוח" title="סוגי מקומות נופש" items={presentation.types} />
    <section className="home-editorial-copy" aria-labelledby="home-editorial-title"><span>בוחרים בדרך שנוחה לכם</span><h2 id="home-editorial-title">{presentation.editorialTitle}</h2><p>{presentation.editorialBody}</p><Link href="/search" prefetch={false} className="button primary" data-global-feedback="true" data-loading-label="פותחים את החיפוש...">לכל מקומות הנופש</Link></section>
  </div>;
}
