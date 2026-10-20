import Link from "next/link";
import type { DiscoveryItem } from "../data/world-data";
import type { Property } from "../data/site-data";

type NearbyItem = { id: string; name: string; location: string; image: string; href: string; meta: string };
type NearbyGroup = { id: "vacation" | "spa" | "activities" | "providers"; eyebrow: string; title: string; href: string; items: NearbyItem[] };

function vacationItem(property: Property): NearbyItem {
  return { id: property.slug, name: property.name, location: property.location || property.area, image: property.image,
    href: `/business?id=${encodeURIComponent(property.slug)}`, meta: property.guests > 0 ? `עד ${property.guests} אורחים` : property.type };
}

function discoveryItem(item: DiscoveryItem): NearbyItem {
  return { id: item.id, name: item.name, location: item.location || item.area, image: item.image || item.images?.[0] || "",
    href: `/discover/place/${encodeURIComponent(item.id)}`, meta: item.world === "spa" ? item.priceLabel || "חבילות וטיפולים"
      : item.world === "activities" ? item.duration || item.features[0] || "חוויה באזור" : item.features[0] || "שירות שמגיע לאזור" };
}

export function TrailNearbyWorlds({ area, vacations, spas, attractions, providers }: {
  area: string; vacations: Property[]; spas: DiscoveryItem[]; attractions: DiscoveryItem[]; providers: DiscoveryItem[];
}) {
  const allGroups: NearbyGroup[] = [
    { id: "vacation", eyebrow: "נשארים באזור", title: "נופש ליד המסלול", href: `/search?location=${encodeURIComponent(area)}`, items: vacations.map(vacationItem) },
    { id: "spa", eyebrow: "נרגעים אחרי הדרך", title: "ספא באזור", href: `/spas?location=${encodeURIComponent(area)}`, items: spas.map(discoveryItem) },
    { id: "activities", eyebrow: "מוסיפים ליום", title: "אטרקציות בסביבה", href: `/attractions?area=${encodeURIComponent(area)}`, items: attractions.map(discoveryItem) },
    { id: "providers", eyebrow: "משלימים את החופשה", title: "ספקים שמגיעים לאזור", href: "/providers", items: providers.map(discoveryItem) },
  ];
  const groups = allGroups.filter((group) => group.items.length > 0);

  return <section id="trail-nearby-worlds" className="section trail-nearby-worlds" aria-labelledby="trail-nearby-worlds-title"><div className="shell">
    <header className="trail-nearby-worlds__intro"><span className="eyebrow">מתכננים מעבר למסלול</span><h2 id="trail-nearby-worlds-title">משלימים את הטיול באזור</h2><p>מקום ללון, ספא להמשך רגוע, אטרקציה נוספת וספקים שיכולים להגיע לחופשה.</p></header>
    <div className="trail-nearby-worlds__grid">{groups.map((group) => <section className={`trail-nearby-group trail-nearby-group--${group.id}`} key={group.id} aria-labelledby={`trail-nearby-${group.id}`}>
      <header><div><span>{group.eyebrow}</span><h3 id={`trail-nearby-${group.id}`}>{group.title}</h3></div><Link href={group.href}>לכל האפשרויות</Link></header>
      <div className="trail-nearby-group__items">{group.items.slice(0, 3).map((item, index) => <Link className={index === 0 ? "trail-nearby-card trail-nearby-card--featured" : "trail-nearby-card"} href={item.href} key={item.id}>
        <img src={item.image} alt="" loading="lazy" decoding="async" /><span><small>{item.location}</small><strong>{item.name}</strong><em>{item.meta}</em></span><b aria-hidden="true">←</b>
      </Link>)}</div>
    </section>)}</div>
  </div></section>;
}
