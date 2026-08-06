"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { Property } from "../data/site-data";
import { PinIcon } from "../site-header";
import { FavoriteButton } from "./favorite-button";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="stay-card">
      <div className="stay-card__media">
        <Link href={`/business?id=${property.slug}`} aria-label={`פרטים על ${property.name}`}>
          <img src={property.image} alt={property.name} />
        </Link>
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
