"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { defaultHomepagePresentation, parseHomepagePresentation, type HomeDiscoveryItem } from "../lib/homepage-presentation";
import { HomeSliderControls } from "./home-slider-controls";
import { normalizeHomepageItems } from "../lib/homepage-search-href";
import { type PopularSearchWorld } from "../lib/world-popular-search-defaults";
import { requestNearbyOrigin } from "./use-nearby-sort";
import { useRouter } from "next/navigation";
import { DiscoveryThumbnail } from "./discovery-thumbnail";

type Presentation = {
  popular: HomeDiscoveryItem[];
  cities: HomeDiscoveryItem[];
  types: HomeDiscoveryItem[];
  editorialTitle: string;
  editorialBody: string;
};

const presentationLoads = new Map<string, { until: number; promise: Promise<Presentation> }>();
function loadPresentation(key: string, url: string) {
  const cached = presentationLoads.get(key);
  if (cached && cached.until > Date.now()) return cached.promise;
  const promise = fetch(url, { signal: AbortSignal.timeout(5000) }).then(response => {
    if (!response.ok) throw new Error("presentation_unavailable"); return response.json();
  }).catch(error => { presentationLoads.delete(key); throw error; });
  presentationLoads.set(key, { until: Date.now() + 60_000, promise });
  return promise;
}
function usePresentation(world: PopularSearchWorld = "vacation") {
  const { language } = useSiteLanguage();
  const key = `${language}:${world}`;
  const [scoped, setScoped] = useState<{ key: string; value: Presentation } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPresentation(key, `/api/vii/homepage-presentation?locale=${language}&world=${world}`)
      .then((value: Presentation) => { if (alive) setScoped({ key, value: {
        ...value, popular: normalizeHomepageItems(value.popular), cities: normalizeHomepageItems(value.cities), types: normalizeHomepageItems(value.types),
      } }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [language, world, key]);
  return scoped?.key === key ? scoped.value : parseHomepagePresentation(undefined, world);
}

function PopularSearchLink({ item }: { item: HomeDiscoveryItem }) {
  const { language, translate } = useSiteLanguage();
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const label = translate(item.label);
  const imageAlt = item.imageAlt?.endsWith(", תמונת אווירה") ? `${translate(item.imageAlt.slice(0, -", תמונת אווירה".length))}, ${translate("תמונת אווירה")}` : translate(item.imageAlt || item.label);
  return <div className="home-popular-search-item">
    <Link href={localizedPath(item.href, language)} prefetch={false} aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={event => {
      if (item.action !== "nearby" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (pending.current) return;
      pending.current = true; setBusy(true); setError(false);
      void requestNearbyOrigin().then(() => {
        const target = new URL(item.href, window.location.origin); target.searchParams.set("sort", "nearest");
        router.push(localizedPath(`${target.pathname}${target.search}${target.hash}`, language));
      }).catch(() => setError(true)).finally(() => { pending.current = false; setBusy(false); });
    }}>{item.action === "nearby" ? <MapPin className="home-popular-search-location" aria-hidden="true" /> : <DiscoveryThumbnail src={item.image} alt={imageAlt} loading="lazy" decoding="async" />}<span><strong>{label}</strong>{item.note ? <small>{translate(item.note)}</small> : null}</span></Link>
    {error ? <small className="home-popular-search-error" role="status">{translate("לא התקבל מיקום. לחצו שוב כדי לנסות מחדש.")}</small> : null}
  </div>;
}

function DiscoveryRail({ id, title, items }: { id: string; title: string; items: HomeDiscoveryItem[] }) {
  const { language } = useSiteLanguage();
  if (!items.length) return null;
  return <section className="home-managed-discovery" aria-labelledby={`${id}-title`}>
    <div className="home-managed-discovery__head"><div><h3 id={`${id}-title`}>{title}</h3></div><HomeSliderControls railId={`${id}-track`} label={title} itemSelector=":scope > a" /></div>
    <nav id={`${id}-track`} className="home-managed-discovery__track search-depth__rail" data-horizontal-rail aria-label={title}>{items.map((item) => <Link className="search-depth__discovery-card" key={item.id} href={localizedPath(item.href, language)} prefetch={false} data-global-feedback="true" data-loading-label={`פותחים ${item.label}...`}>
      <span className="search-depth__discovery-icon home-managed-discovery__visual"><DiscoveryThumbnail src={item.image} alt={item.imageAlt || item.label} title={item.imageAlt || item.label} loading="lazy" decoding="async" /></span>
      <strong>{item.label}</strong>
      {item.note ? <small>{item.note}</small> : <small>לצפייה בתוצאות</small>}
      <span className="search-depth__discovery-arrow" aria-hidden="true">←</span>
    </Link>)}</nav>
  </section>;
}

export function HomeQuickSearches({ world = "vacation" }: { world?: PopularSearchWorld }) {
  const { language, translate } = useSiteLanguage();
  const presentation = usePresentation(world);
  const id = world === "vacation" ? "home-popular-searches" : `popular-searches-${world}`;
  if (!presentation.popular.length) return null;
  return <section className="home-visual-searches" aria-labelledby={`${id}-title`}>
    <div className="home-visual-searches__head">
      <div className="home-visual-searches__title"><Search aria-hidden="true" /><h2 id={`${id}-title`}>{translate("חיפושים פופולריים")}</h2></div>
      <HomeSliderControls railId={`${id}-track`} label={translate("חיפושים פופולריים")} itemSelector=":scope > .home-popular-search-item" />
    </div>
    <nav id={`${id}-track`} className="home-visual-searches__track" dir={language === "he" ? "rtl" : "ltr"} data-horizontal-rail aria-label={translate("חיפושים פופולריים")} tabIndex={0}>{presentation.popular.map(item => <PopularSearchLink key={item.id} item={item} />)}</nav>
  </section>;
}

export function HomeManagedDiscovery() {
  const { language } = useSiteLanguage();
  const presentation = usePresentation();
  return <div className="home-managed-discovery-wrap">
    <DiscoveryRail id="home-city-rail" title="חיפוש לפי עיר ואזור" items={presentation.cities} />
    <DiscoveryRail id="home-type-rail" title="סוגי מקומות נופש" items={presentation.types} />
    <section className="home-editorial-copy" aria-labelledby="home-editorial-title"><h2 id="home-editorial-title">{presentation.editorialTitle}</h2><p>{presentation.editorialBody}</p><Link href={localizedPath("/search", language)} prefetch={false} className="button primary" data-global-feedback="true" data-loading-label="פותחים את החיפוש...">לכל מקומות הנופש</Link></section>
  </div>;
}
