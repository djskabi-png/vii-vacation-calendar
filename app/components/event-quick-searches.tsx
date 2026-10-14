"use client";

import Link from "next/link";
import type { EventLandingSearchItem } from "../lib/event-landing-presentation";
import { HomeSliderControls } from "./home-slider-controls";

export function EventQuickSearches({ eyebrow, title, items }: { eyebrow: string; title: string; items: EventLandingSearchItem[] }) {
  if (!items.length) return null;
  return <section className="event-quick-searches shell" aria-labelledby="event-quick-searches-title">
    <div className="event-quick-searches__head">
      <div><span className="eyebrow">{eyebrow}</span><h2 id="event-quick-searches-title">{title}</h2></div>
      <HomeSliderControls railId="event-quick-searches-rail" label={title} itemSelector=":scope > a" />
    </div>
    <div id="event-quick-searches-rail" className="event-quick-searches__rail" data-horizontal-rail>
      {items.map((item) => <Link key={item.id} href={item.href} prefetch={false} data-global-feedback="true" data-loading-label={`מחפשים ${item.label}...`}>
        <img src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
        <span className="event-quick-searches__shade" aria-hidden="true" />
        <span className="event-quick-searches__copy"><strong>{item.label}</strong>{item.note ? <small>{item.note}</small> : null}<b>לצפייה במקומות <span aria-hidden="true">←</span></b></span>
      </Link>)}
    </div>
  </section>;
}
