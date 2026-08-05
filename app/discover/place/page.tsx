"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DiscoveryCard } from "../../components/discovery-card";
import { PageShell } from "../../components/page-shell";
import { discoveryItems, worlds, type WorldId } from "../../data/world-data";
import { PinIcon } from "../../site-header";

export default function DiscoveryPlacePage() {
  const [id, setId] = useState(discoveryItems[0].id);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(location.search).get("id");
      if (requested && discoveryItems.some((item) => item.id === requested)) setId(requested);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const item = useMemo(() => discoveryItems.find((entry) => entry.id === id) || discoveryItems[0], [id]);
  const world = worlds.find((entry) => entry.id === item.world) || worlds[2];
  const related = discoveryItems.filter((entry) => entry.world === item.world && entry.id !== item.id).slice(0, 3);

  return <PageShell variant={item.world as WorldId}>
    <main id="main-content" className={`discovery-detail discovery-detail--${item.world}`}>
      <div className="shell breadcrumbs"><Link href={world.href}>{world.label}</Link><span>/</span><span>{item.name}</span></div>
      <section className="shell discovery-detail__hero">
        <div className="discovery-detail__copy"><span className="eyebrow">{item.demo ? "פרופיל הדגמה" : world.label}</span><h1>{item.name}</h1><p className="discovery-detail__location"><PinIcon />{item.location}, {item.area}</p><p>{item.description}</p><div className="discovery-card__chips">{item.features.map((feature) => <span key={feature}>{feature}</span>)}</div>{item.demo && <div className="demo-notice"><strong>חשוב לדעת</strong><p>זהו תוכן הדגמה שממחיש את מבנה השירות. הוא אינו עסק פעיל ואי אפשר להזמין אותו.</p></div>}<div className="discovery-detail__actions">{item.sourceUrl ? <a className="button primary" href={item.sourceUrl} target="_blank" rel="noreferrer">לפרטים באתר {item.sourceName}</a> : <Link className="button primary" href={world.href}>לכל האפשרויות</Link>}<Link className="button secondary" href={world.href}>חזרה לרשימה</Link></div></div>
        <div className={`discovery-detail__media discovery-card__placeholder--${item.world}`}>{item.image ? <img src={item.image} alt={item.name} /> : <span><b>{item.name.slice(0, 1)}</b><small>{item.demo ? "פרופיל הדגמה" : "רעיון מערכת"}</small></span>}</div>
      </section>
      <section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">באותו עולם</span><h2>עוד אפשרויות שכדאי לראות</h2></div></div><div className="discovery-grid">{related.map((entry) => <DiscoveryCard key={entry.id} item={entry} />)}</div></div></section>
    </main>
  </PageShell>;
}
