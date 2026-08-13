"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { FavoriteButton } from "../components/favorite-button";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { eventPlaceHref, eventPlaces, properties } from "../data/site-data";
import { readSavedItems, savedItemKey, SAVED_ITEMS_EVENT, type SavedItem, type SavedWorld, writeSavedItems } from "../lib/saved-items";

const worldLabels: Record<SiteLanguage, Record<SavedWorld, string>> = {
  he: { vacation: "נופש", events: "אירועים ולופטים", corporate: "אירועי חברה", spa: "ספא", hourly: "חדרים לפי שעה", providers: "ספקים", activities: "אטרקציות", trails: "מסלולי טיול" },
  en: { vacation: "Stays", events: "Events and lofts", corporate: "Corporate events", spa: "Spa", hourly: "Hourly stays", providers: "Services", activities: "Attractions", trails: "Trails" },
  ru: { vacation: "Отдых", events: "Мероприятия и лофты", corporate: "Корпоративные мероприятия", spa: "Спа", hourly: "Почасовой отдых", providers: "Услуги", activities: "Аттракционы", trails: "Маршруты" },
  fr: { vacation: "Séjours", events: "Événements et lofts", corporate: "Événements d’entreprise", spa: "Spa", hourly: "Séjours à l'heure", providers: "Services", activities: "Attractions", trails: "Randonnées" },
};

const pageCopy = {
  he: { eyebrow: "שומרים את כל החוויה", title: "המקומות שאהבתי", intro: "נופש, אירועים, ספא, ספקים, חדרים לפי שעה, אטרקציות ומסלולים, הכול נשמר כאן במקום אחד.", one: "פריט שמור", many: "פריטים שמורים", account: "לחשבון האישי", all: "הכול", filterLabel: "סינון המקומות שאהבתי", details: "לפרטים ולהזמנה", emptyTitle: "מתחילים לשמור מכאן", emptyText: "לחצו על הלב בכל מקום, ספק או חוויה שאהבתם. כל הבחירות יופיעו כאן ויחכו לכם.", stripEyebrow: "לא מאבדים אף בחירה", stripTitle: "שומרים אהובים והזמנות בחשבון אחד", stripText: "החשבון האישי מרכז את מה ששמרתם ואת ההזמנות שביצעתם, גם כשתעברו בין מכשירים לאחר חיבור מערכת המשתמשים.", login: "כניסה לחשבון", guests: "אורחים" },
  en: { eyebrow: "Keep the whole experience", title: "My favorites", intro: "Stays, events, spas, services, hourly rooms, attractions and trails, all saved in one place.", one: "saved item", many: "saved items", account: "My account", all: "All", filterLabel: "Filter favorites", details: "Details and booking", emptyTitle: "Start saving favorites", emptyText: "Tap the heart on any place, service or experience you love. Every choice will be waiting for you here.", stripEyebrow: "Never lose a favorite", stripTitle: "Favorites and bookings in one account", stripText: "Your account keeps saved choices and bookings together, including across devices once account sync is connected.", login: "Sign in", guests: "guests" },
  ru: { eyebrow: "Сохраняйте всё впечатление", title: "Моё избранное", intro: "Отдых, мероприятия, спа, услуги, почасовые номера, аттракционы и маршруты, всё в одном месте.", one: "сохранённый объект", many: "сохранённых объектов", account: "Мой аккаунт", all: "Все", filterLabel: "Фильтр избранного", details: "Подробнее и бронирование", emptyTitle: "Начните сохранять", emptyText: "Нажмите на сердце у понравившегося места, услуги или впечатления. Всё сохранённое появится здесь.", stripEyebrow: "Ничего не теряется", stripTitle: "Избранное и бронирования в одном аккаунте", stripText: "В аккаунте собраны ваши сохранённые варианты и бронирования, в том числе на разных устройствах после подключения синхронизации.", login: "Войти", guests: "гостей" },
  fr: { eyebrow: "Gardez toute l'expérience", title: "Mes favoris", intro: "Séjours, événements, spas, services, chambres à l'heure, attractions et randonnées, tout est enregistré ici.", one: "favori enregistré", many: "favoris enregistrés", account: "Mon compte", all: "Tous", filterLabel: "Filtrer les favoris", details: "Détails et réservation", emptyTitle: "Commencez à enregistrer", emptyText: "Touchez le cœur d'un lieu, d'un service ou d'une expérience que vous aimez. Tous vos choix apparaîtront ici.", stripEyebrow: "Ne perdez aucun choix", stripTitle: "Favoris et réservations dans un seul compte", stripText: "Votre compte rassemble vos favoris et vos réservations, y compris sur plusieurs appareils une fois la synchronisation activée.", login: "Se connecter", guests: "personnes" },
};

function localizeMeta(item: SavedItem, language: SiteLanguage) {
  if (language === "he") return item.meta;
  const guestCount = item.meta?.match(/(\d+)\s*אורחים/)?.[1];
  return guestCount ? `${worldLabels[language][item.world]} · ${guestCount} ${pageCopy[language].guests}` : worldLabels[language][item.world];
}

function localizeLocation(location: string, translate: (value: string) => string) {
  return location.split(",").map((part) => translate(part.trim())).join(", ");
}

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
  const { language, translate } = useSiteLanguage();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeWorld, setActiveWorld] = useState<SavedWorld | "all">("all");
  const [ready, setReady] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const copy = pageCopy[language];
  const labels = worldLabels[language];
  const statusCopy = {
    he: { title: "טוענים את המקומות שאהבתי", description: "אוספים את כל המקומות והחוויות ששמרתם.", filtering: "מעדכנים את התוצאות..." },
    en: { title: "Loading your favorites", description: "Gathering all the places and experiences you saved.", filtering: "Updating results..." },
    ru: { title: "Загружаем избранное", description: "Собираем все сохранённые места и впечатления.", filtering: "Обновляем результаты..." },
    fr: { title: "Chargement de vos favoris", description: "Nous rassemblons tous les lieux et expériences enregistrés.", filtering: "Mise à jour des résultats..." },
  }[language];

  useEffect(() => {
    const sync = () => {
      setItems(readSavedItems());
      setReady(true);
    };
    const timer = window.setTimeout(() => {
      setItems(migrateLegacyFavorites());
      setReady(true);
    }, 180);
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

  function selectWorld(world: SavedWorld | "all") {
    if (world === activeWorld || filtering) return;
    setFiltering(true);
    window.setTimeout(() => {
      setActiveWorld(world);
      setFiltering(false);
    }, 220);
  }

  return <PageShell>
    <main id="main-content" className="favorites-page" data-no-translate lang={language} dir={language === "he" ? "rtl" : "ltr"}>
      <section className="favorites-hero">
        <div className="shell favorites-hero__inner">
          <div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.intro}</p></div>
          <aside><strong>{items.length}</strong><span>{items.length === 1 ? copy.one : copy.many}</span><Link href="/account">{copy.account}</Link></aside>
        </div>
      </section>

      <section className={`favorites-content shell${filtering ? " is-filtering" : ""}`} aria-busy={!ready || filtering}>
        {!ready ? <div className="favorites-loading" role="status"><span aria-hidden="true" /><h2>{statusCopy.title}</h2><p>{statusCopy.description}</p><div><i /><i /><i /></div></div> : items.length ? <>
          <nav className="favorites-tabs" aria-label={copy.filterLabel}>
            <button type="button" className={activeWorld === "all" ? "active" : ""} aria-pressed={activeWorld === "all"} onClick={() => selectWorld("all")}>{copy.all} <span>{items.length}</span></button>
            {availableWorlds.map((world) => <button key={world} type="button" className={activeWorld === world ? "active" : ""} aria-pressed={activeWorld === world} onClick={() => selectWorld(world)}>{labels[world]} <span>{items.filter((item) => item.world === world).length}</span></button>)}
          </nav>
          {filtering ? <div className="favorites-filtering" role="status"><span aria-hidden="true" />{statusCopy.filtering}</div> : null}
          <div className="favorites-grid">
            {visibleItems.map((item) => <article key={item.key} className="favorite-card">
              <Link className="favorite-card__media" href={item.href}>{item.image ? <img src={item.image} alt={translate(item.name)} /> : <span>{translate(item.name).slice(0, 1)}</span>}</Link>
              <FavoriteButton id={item.id} world={item.world} name={item.name} location={item.location} image={item.image} href={item.href} meta={item.meta} />
              <div className="favorite-card__body"><small>{labels[item.world]}</small><h2><Link href={item.href}>{translate(item.name)}</Link></h2><p>{localizeLocation(item.location, translate)}</p>{localizeMeta(item, language) ? <span>{translate(localizeMeta(item, language) || "")}</span> : null}<Link className="button secondary" href={item.href}>{copy.details}</Link></div>
            </article>)}
          </div>
        </> : <div className="favorites-empty">
          <div><span aria-hidden="true">♡</span><h2>{copy.emptyTitle}</h2><p>{copy.emptyText}</p></div>
          <div className="favorites-empty__links">
            <Link href="/search"><span>{labels.vacation}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/events/search"><span>{labels.events}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/corporate"><span>{labels.corporate}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/spas"><span>{labels.spa}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/providers"><span>{labels.providers}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/hourly"><span>{labels.hourly}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/attractions"><span>{labels.activities}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
            <Link href="/trails"><span>{labels.trails}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>
          </div>
        </div>}
      </section>
      <section className="favorites-account-strip"><div className="shell"><div><span className="eyebrow">{copy.stripEyebrow}</span><h2>{copy.stripTitle}</h2><p>{copy.stripText}</p></div><Link className="button primary" href="/account">{copy.login}</Link></div></section>
    </main>
  </PageShell>;
}
