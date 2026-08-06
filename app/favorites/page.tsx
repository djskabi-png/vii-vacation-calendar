"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { FavoriteButton } from "../components/favorite-button";
import { eventPlaceHref, eventPlaces, properties } from "../data/site-data";
import { readSavedItems, savedItemKey, SAVED_ITEMS_EVENT, type SavedItem, type SavedWorld, writeSavedItems } from "../lib/saved-items";

const worldLabels: Record<SavedWorld, string> = {
  vacation: "נופש",
  events: "אירועים ולופטים",
  spa: "ספא",
  hourly: "חדרים לפי שעה",
  providers: "ספקים",
  activities: "אטרקציות",
  trails: "מסלולי טיול",
};

function migrateLegacyFavorites() {
  const existing = readSavedItems();
  const known = new Set(existing.map((item) => item.key));
  let propertyIds: string[] = [];
  let eventIds: string[] = [];
  try { propertyIds = JSON.parse(localStorage.getItem("vii-favourites") || "[]"); } catch { propertyIds = []; }
  try { eventIds = JSON.parse(localStorage.getItem("vii-event-favourites") || "[]"); } catch { eventIds = []; }

  const migrated: SavedItem[] = [];
  properties.filter((property) => propertyIds.includes(property.slug)).forEach((property) => {
    const key = savedItemKey("vacation", property.slug);
    if (!known.has(key)) migrated.push({ key, id: property.slug, world: "vacation", name: property.name, location: `${property.location}, ${property.area}`, image: property.image, href: `/business?id=${property.slug}`, meta: `${property.type} · עד ${property.guests} אורחים`, savedAt: new Date().toISOString() });
  });
  eventPlaces.filter((place) => eventIds.includes(place.slug)).forEach((place) => {
    const key = savedItemKey("events", place.slug);
    if (!known.has(key)) migrated.push({ key, id: place.slug, world: "events", name: place.name, location: `${place.location}, ${place.area}`, image: place.image, href: eventPlaceHref(place), meta: `${place.type} · עד ${place.guests} אורחים`, savedAt: new Date().toISOString() });
  });
  if (migrated.length) writeSavedItems([...migrated, ...existing]);
  return [...migrated, ...existing];
}

export default function FavoritesPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeWorld, setActiveWorld] = useState<SavedWorld | "all">("all");

  useEffect(() => {
    const sync = () => setItems(readSavedItems());
    const timer = window.setTimeout(() => setItems(migrateLegacyFavorites()), 0);
    window.addEventListener(SAVED_ITEMS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SAVED_ITEMS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const availableWorlds = useMemo(() => Array.from(new Set(items.map((item) => item.world))), [items]);
  const visibleItems = activeWorld === "all" ? items : items.filter((item) => item.world === activeWorld);

  return <PageShell>
    <main id="main-content" className="favorites-page">
      <section className="favorites-hero">
        <div className="shell favorites-hero__inner">
          <div><span className="eyebrow">שומרים את כל החוויה</span><h1>המקומות שאהבתי</h1><p>נופש, אירועים, ספא, ספקים, חדרים לפי שעה, אטרקציות ומסלולים, הכול נשמר כאן במקום אחד.</p></div>
          <aside><strong>{items.length}</strong><span>{items.length === 1 ? "פריט שמור" : "פריטים שמורים"}</span><Link href="/account">לחשבון האישי</Link></aside>
        </div>
      </section>

      <section className="favorites-content shell">
        {items.length ? <>
          <nav className="favorites-tabs" aria-label="סינון המקומות שאהבתי">
            <button type="button" className={activeWorld === "all" ? "active" : ""} onClick={() => setActiveWorld("all")}>הכול <span>{items.length}</span></button>
            {availableWorlds.map((world) => <button key={world} type="button" className={activeWorld === world ? "active" : ""} onClick={() => setActiveWorld(world)}>{worldLabels[world]} <span>{items.filter((item) => item.world === world).length}</span></button>)}
          </nav>
          <div className="favorites-grid">
            {visibleItems.map((item) => <article key={item.key} className="favorite-card">
              <Link className="favorite-card__media" href={item.href}>{item.image ? <img src={item.image} alt={item.name} /> : <span>{item.name.slice(0, 1)}</span>}</Link>
              <FavoriteButton {...item} />
              <div className="favorite-card__body"><small>{worldLabels[item.world]}</small><h2><Link href={item.href}>{item.name}</Link></h2><p>{item.location}</p>{item.meta ? <span>{item.meta}</span> : null}<Link className="button secondary" href={item.href}>לפרטים ולהזמנה</Link></div>
            </article>)}
          </div>
        </> : <div className="favorites-empty">
          <div><span aria-hidden="true">♡</span><h2>מתחילים לשמור מכאן</h2><p>לחצו על הלב בכל מקום, ספק או חוויה שאהבתם. כל הבחירות יופיעו כאן ויחכו לכם.</p></div>
          <div className="favorites-empty__links"><Link href="/search">נופש</Link><Link href="/events/search">אירועים</Link><Link href="/spas">ספא</Link><Link href="/providers">ספקים</Link><Link href="/hourly">לפי שעה</Link><Link href="/attractions">אטרקציות</Link><Link href="/trails">מסלולים</Link></div>
        </div>}
      </section>
      <section className="favorites-account-strip"><div className="shell"><div><span className="eyebrow">לא מאבדים אף בחירה</span><h2>שומרים אהובים והזמנות בחשבון אחד</h2><p>החשבון האישי מרכז את מה ששמרתם ואת ההזמנות שביצעתם, גם כשתעברו בין מכשירים לאחר חיבור מערכת המשתמשים.</p></div><Link className="button primary" href="/account">כניסה לחשבון</Link></div></section>
    </main>
  </PageShell>;
}
