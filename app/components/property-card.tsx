"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import type { Property } from "../data/site-data";
import { PinIcon } from "../site-header";
import { FavoriteButton } from "./favorite-button";

export function PropertyCard({ property }: { property: Property }) {
  const galleryImages = [property.image, ...property.images].filter((src, index, all) => src && all.indexOf(src) === index).slice(0, 10);
  const [imageIndex, setImageIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function moveImage(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => (current + direction + galleryImages.length) % galleryImages.length);
  }

  return (
    <article className="stay-card">
      <div className="stay-card__media" onTouchStart={(event) => { if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); didSwipe.current = false; touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null || galleryImages.length < 2) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) { didSwipe.current = true; swipeResetTimer.current = setTimeout(() => { didSwipe.current = false; swipeResetTimer.current = null; }, 500); setImageIndex((current) => (current + (distance > 0 ? -1 : 1) + galleryImages.length) % galleryImages.length); } touchStart.current = null; }}>
        <Link href={`/business?id=${property.slug}`} aria-label={`פרטים על ${property.name}`} onClick={(event) => { if (!didSwipe.current) return; event.preventDefault(); event.stopPropagation(); didSwipe.current = false; if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); swipeResetTimer.current = null; }}>
          <img key={galleryImages[imageIndex]} src={galleryImages[imageIndex]} alt={`${property.name}, תמונה ${imageIndex + 1} מתוך ${galleryImages.length}`} />
        </Link>
        {galleryImages.length > 1 ? <><button className="stay-card__gallery-arrow stay-card__gallery-arrow--previous" type="button" aria-label={`התמונה הקודמת של ${property.name}`} onClick={(event) => moveImage(event, -1)}><span aria-hidden="true">‹</span></button><button className="stay-card__gallery-arrow stay-card__gallery-arrow--next" type="button" aria-label={`התמונה הבאה של ${property.name}`} onClick={(event) => moveImage(event, 1)}><span aria-hidden="true">›</span></button><div className="stay-card__gallery-dots" aria-label={`בחירת תמונה של ${property.name}`}>{galleryImages.slice(0, 5).map((src, index) => { const active = imageIndex === index || index === 4 && imageIndex >= 4; return <button key={src} className={active ? "active" : ""} type="button" aria-label={`הצגת תמונה ${index + 1} של ${property.name}`} aria-current={active ? "true" : undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setImageIndex(index); }} />; })}</div><span className="stay-card__gallery-count" aria-live="polite">{imageIndex + 1}/{galleryImages.length}</span></> : null}
        <FavoriteButton className="heart-button" id={property.slug} world="vacation" name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}`} meta={`${property.type} · עד ${property.guests} אורחים`} />
        <div className="stay-card__badges">{property.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
      </div>
      <div className="stay-card__body">
        <div className="stay-card__title">
          <div>
            <h3><Link href={`/business?id=${property.slug}`}>{property.name}</Link></h3>
            <p><PinIcon />{property.location}, {property.area}</p>
          </div>
          {property.score && <span className="score"><b>{property.score}</b><small>{property.reviews} חוות דעת</small></span>}
        </div>
        <p className="stay-card__meta">{property.type}{property.units && property.units > 1 ? `, ${property.units} יחידות` : ", מקום אירוח שלם"} · עד {property.guests} אורחים</p>
        <div className="feature-chips">{property.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div>
        <div className="stay-card__footer">
          <span>{property.price ? <><small>החל מ־</small><b>₪{property.price}</b><small> ללילה</small></> : "מחיר לפי תאריך"}</span>
          <Link className="button secondary" href={`/business?id=${property.slug}`}>לפרטים וזמינות</Link>
        </div>
      </div>
    </article>
  );
}
