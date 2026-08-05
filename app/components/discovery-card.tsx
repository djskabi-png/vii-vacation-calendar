/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { DiscoveryItem } from "../data/world-data";
import { PinIcon } from "../site-header";

export function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  return <article className={`discovery-card discovery-card--${item.world}`}>
    <Link className="discovery-card__visual" href={`/discover/place?world=${item.world}&id=${item.id}`} aria-label={`פרטים על ${item.name}`}>
      {item.image ? <img src={item.image} alt={item.imageLabel ? `תמונת אווירה לתחום ${item.features[0]}` : item.name} /> : <span className={`discovery-card__placeholder discovery-card__placeholder--${item.world}`}><b>{item.name.slice(0, 1)}</b><small>{item.demo ? "פרופיל הדגמה" : "רעיון מערכת"}</small></span>}
      {item.imageLabel && <span className="image-context-label">{item.imageLabel}</span>}
      {item.demo && <span className="demo-badge">הדגמה</span>}
      {item.rating && <span className="rating-badge">★ {item.rating.toFixed(1)}</span>}
    </Link>
    <div className="discovery-card__body">
      <span className="discovery-card__meta"><PinIcon />{item.location}<small>{item.area}</small></span>
      <h3><Link href={`/discover/place?world=${item.world}&id=${item.id}`}>{item.name}</Link></h3>
      <p>{item.description}</p>
      <div className="discovery-card__chips">{item.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div>
      <footer><strong>{item.priceLabel || item.duration || "לפרטים"}</strong><Link href={`/discover/place?world=${item.world}&id=${item.id}`}>לפרטים</Link></footer>
    </div>
  </article>;
}
