"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Property } from "../data/site-data";
import { HeartIcon, PinIcon } from "../site-header";

export function PropertyCard({ property }: { property: Property }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const items = JSON.parse(localStorage.getItem("vii-favourites") || "[]") as string[];
      setSaved(items.includes(property.slug));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [property.slug]);
  function toggle() {
    const items = JSON.parse(localStorage.getItem("vii-favourites") || "[]") as string[];
    const next = items.includes(property.slug) ? items.filter((item) => item !== property.slug) : [...items, property.slug];
    localStorage.setItem("vii-favourites", JSON.stringify(next));
    setSaved(next.includes(property.slug));
    window.dispatchEvent(new Event("vii-favourites-change"));
  }
  return (
    <article className="stay-card">
      <div className="stay-card__media">
        <Link href={`/business/?scenario=${property.scenario}`} aria-label={`פרטים על ${property.name}`}><img src={property.image} alt={property.name} /></Link>
        <button type="button" className="heart-button" aria-label={saved ? "הסרה מהמועדפים" : "שמירה במועדפים"} aria-pressed={saved} onClick={toggle}><HeartIcon filled={saved} /></button>
        <div className="stay-card__badges">{property.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
      </div>
      <div className="stay-card__body">
        <div className="stay-card__title"><div><h3><Link href={`/business/?scenario=${property.scenario}`}>{property.name}</Link></h3><p><PinIcon />{property.location}, {property.area}</p></div>{property.score && <span className="score"><b>{property.score}</b><small>{property.reviews} חוות דעת</small></span>}</div>
        <p className="stay-card__meta">{property.type}{property.units ? `, ${property.units} יחידות` : ", מקום אירוח שלם"} · עד {property.guests} אורחים</p>
        <div className="feature-chips">{property.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div>
        <div className="stay-card__footer"><span>{property.price ? <><small>החל מ</small><b>₪{property.price}</b><small> ללילה</small></> : "מחיר לפי תאריך"}</span><Link className="button secondary" href={`/business/?scenario=${property.scenario}`}>לפרטים וזמינות</Link></div>
      </div>
    </article>
  );
}
