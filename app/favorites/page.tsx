"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "../components/favorite-button";
import { PageShell } from "../components/page-shell";
import { eventPlaceHref, eventPlaces, properties } from "../data/site-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { readSavedItems, savedItemKey, SAVED_ITEMS_EVENT, type SavedItem, type SavedWorld, writeSavedItems } from "../lib/saved-items";
import { clearViewedItems, readViewedItems, VIEWED_ITEMS_EVENT, type ViewedItem } from "../lib/viewed-items";

type LibraryMode = "saved" | "viewed";
type LibraryItem = SavedItem | ViewedItem;
const PAGE_SIZE = 8;

const worldLabels: Record<SiteLanguage, Record<SavedWorld, string>> = {
  he: { vacation: "נופש", events: "אירועים ולופטים", corporate: "אירועי חברה", spa: "ספא וטיפולים", hourly: "חדרים לפי שעה", providers: "ספקים", activities: "אטרקציות", trails: "מסלולי טיול" },
  en: { vacation: "Stays", events: "Events and lofts", corporate: "Corporate events", spa: "Spa and treatments", hourly: "Hourly stays", providers: "Services", activities: "Attractions", trails: "Trails" },
  ru: { vacation: "Отдых", events: "Мероприятия и лофты", corporate: "Корпоративные мероприятия", spa: "Спа и процедуры", hourly: "Почасовой отдых", providers: "Услуги", activities: "Аттракционы", trails: "Маршруты" },
  fr: { vacation: "Séjours", events: "Événements et lofts", corporate: "Événements d’entreprise", spa: "Spa et soins", hourly: "Séjours à l'heure", providers: "Services", activities: "Attractions", trails: "Randonnées" },
};

const copyByLanguage = {
  he: {
    eyebrow: "כל הבחירות במקום אחד", savedTitle: "המקומות שאהבתי", viewedTitle: "המקומות שראיתי", savedIntro: "כל המקומות, הספקים והחוויות שסימנתם בלב.", viewedIntro: "היסטוריית צפייה מסודרת מכל עולמות האתר, מהחדש לישן.", saved: "אהבתי", viewed: "צפיתי", oneSaved: "פריט שמור", manySaved: "פריטים שמורים", oneViewed: "פריט שנצפה", manyViewed: "פריטים שנצפו", account: "לחשבון האישי", all: "הכול", filterSaved: "סינון המקומות שאהבתי", filterViewed: "סינון המקומות שראיתי", details: "לפרטים ולהזמנה", viewedAt: "נצפה", emptySavedTitle: "מתחילים לשמור מכאן", emptySavedText: "לחצו על הלב בכל מקום, ספק או חוויה שאהבתם.", emptyViewedTitle: "עדיין אין היסטוריית צפייה", emptyViewedText: "פתחו כרטיס מקום, טיפול, ספק או חוויה, והוא יישמר כאן אוטומטית.", clear: "ניקוי היסטוריה", clearConfirm: "לחצו שוב לניקוי", previous: "הקודם", next: "הבא", page: "עמוד", loadingSaved: "טוענים את המקומות שאהבתי", loadingViewed: "טוענים את היסטוריית הצפייה", filtering: "מעדכנים את התוצאות...", deviceNote: "ההיסטוריה נשמרת במכשיר הזה בלבד.", stripTitle: "אהובים, צפיות והזמנות בחשבון אחד", stripText: "החשבון האישי מרכז את הבחירות וההזמנות שלכם. היסטוריית הצפייה נשארת פרטית במכשיר.", login: "כניסה לחשבון", guests: "אורחים",
  },
  en: {
    eyebrow: "All your choices in one place", savedTitle: "My favorites", viewedTitle: "Recently viewed", savedIntro: "Every place, service and experience you saved.", viewedIntro: "Your viewing history across every world, newest first.", saved: "Favorites", viewed: "Viewed", oneSaved: "saved item", manySaved: "saved items", oneViewed: "viewed item", manyViewed: "viewed items", account: "My account", all: "All", filterSaved: "Filter favorites", filterViewed: "Filter viewed places", details: "Details and booking", viewedAt: "Viewed", emptySavedTitle: "Start saving favorites", emptySavedText: "Tap the heart on any place, service or experience you love.", emptyViewedTitle: "No viewing history yet", emptyViewedText: "Open a place, treatment, service or experience and it will appear here automatically.", clear: "Clear history", clearConfirm: "Press again to clear", previous: "Previous", next: "Next", page: "Page", loadingSaved: "Loading your favorites", loadingViewed: "Loading viewing history", filtering: "Updating results...", deviceNote: "History is stored on this device only.", stripTitle: "Favorites, views and bookings in one account", stripText: "Your account keeps choices and bookings together. Viewing history stays private on this device.", login: "Sign in", guests: "guests",
  },
  ru: {
    eyebrow: "Все ваши варианты в одном месте", savedTitle: "Моё избранное", viewedTitle: "Недавно просмотренные", savedIntro: "Все места, услуги и впечатления, которые вы сохранили.", viewedIntro: "История просмотров по всем разделам, от новых к старым.", saved: "Избранное", viewed: "Просмотренные", oneSaved: "сохранённый объект", manySaved: "сохранённых объектов", oneViewed: "просмотренный объект", manyViewed: "просмотренных объектов", account: "Мой аккаунт", all: "Все", filterSaved: "Фильтр избранного", filterViewed: "Фильтр истории", details: "Подробнее и бронирование", viewedAt: "Просмотрено", emptySavedTitle: "Начните сохранять", emptySavedText: "Нажмите на сердце у понравившегося места, услуги или впечатления.", emptyViewedTitle: "История пока пуста", emptyViewedText: "Откройте место, процедуру, услугу или впечатление, и оно автоматически появится здесь.", clear: "Очистить историю", clearConfirm: "Нажмите ещё раз", previous: "Назад", next: "Далее", page: "Страница", loadingSaved: "Загружаем избранное", loadingViewed: "Загружаем историю", filtering: "Обновляем результаты...", deviceNote: "История хранится только на этом устройстве.", stripTitle: "Избранное, просмотры и бронирования в одном аккаунте", stripText: "Аккаунт хранит ваши варианты и бронирования. История просмотров остаётся на устройстве.", login: "Войти", guests: "гостей",
  },
  fr: {
    eyebrow: "Tous vos choix au même endroit", savedTitle: "Mes favoris", viewedTitle: "Lieux consultés", savedIntro: "Tous les lieux, services et expériences enregistrés.", viewedIntro: "Votre historique dans tous les univers, du plus récent au plus ancien.", saved: "Favoris", viewed: "Consultés", oneSaved: "favori enregistré", manySaved: "favoris enregistrés", oneViewed: "élément consulté", manyViewed: "éléments consultés", account: "Mon compte", all: "Tous", filterSaved: "Filtrer les favoris", filterViewed: "Filtrer l’historique", details: "Détails et réservation", viewedAt: "Consulté", emptySavedTitle: "Commencez à enregistrer", emptySavedText: "Touchez le cœur d’un lieu, d’un service ou d’une expérience.", emptyViewedTitle: "Aucun historique pour le moment", emptyViewedText: "Ouvrez un lieu, un soin, un service ou une expérience, il apparaîtra ici automatiquement.", clear: "Effacer l’historique", clearConfirm: "Appuyez encore une fois", previous: "Précédent", next: "Suivant", page: "Page", loadingSaved: "Chargement de vos favoris", loadingViewed: "Chargement de l’historique", filtering: "Mise à jour des résultats...", deviceNote: "L’historique est conservé uniquement sur cet appareil.", stripTitle: "Favoris, consultations et réservations dans un seul compte", stripText: "Votre compte rassemble vos choix et réservations. L’historique reste privé sur cet appareil.", login: "Se connecter", guests: "personnes",
  },
} as const;

function HeartTabIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>; }
function EyeTabIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>; }

function localizeMeta(item: LibraryItem, language: SiteLanguage) {
  if (language === "he") return item.meta;
  const guestCount = item.meta?.match(/(\d+)\s*אורחים/)?.[1];
  return guestCount ? `${worldLabels[language][item.world]} · ${guestCount} ${copyByLanguage[language].guests}` : worldLabels[language][item.world];
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
  const [mode, setMode] = useState<LibraryMode>("saved");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>([]);
  const [activeWorld, setActiveWorld] = useState<SavedWorld | "all">("all");
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const copy = copyByLanguage[language];
  const labels = worldLabels[language];
  const items: LibraryItem[] = mode === "viewed" ? viewedItems : savedItems;

  useEffect(() => {
    const readMode = () => setMode(new URLSearchParams(window.location.search).get("view") === "viewed" ? "viewed" : "saved");
    const sync = () => {
      setSavedItems(readSavedItems());
      setViewedItems(readViewedItems());
      setReady(true);
    };
    readMode();
    const timer = window.setTimeout(() => {
      setSavedItems(migrateLegacyFavorites());
      setViewedItems(readViewedItems());
      setReady(true);
    }, 120);
    window.addEventListener("popstate", readMode);
    window.addEventListener(SAVED_ITEMS_EVENT, sync);
    window.addEventListener(VIEWED_ITEMS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", readMode);
      window.removeEventListener(SAVED_ITEMS_EVENT, sync);
      window.removeEventListener(VIEWED_ITEMS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const availableWorlds = useMemo(() => Array.from(new Set(items.map((item) => item.world))), [items]);
  const filteredItems = activeWorld === "all" ? items : items.filter((item) => item.world === activeWorld);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function selectMode(nextMode: LibraryMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setActiveWorld("all");
    setPage(1);
    setClearArmed(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextMode);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function selectWorld(world: SavedWorld | "all") {
    if (world === activeWorld || filtering) return;
    setFiltering(true);
    window.setTimeout(() => {
      setActiveWorld(world);
      setPage(1);
      setFiltering(false);
    }, 160);
  }

  function resetViewedHistory() {
    if (!clearArmed) {
      setClearArmed(true);
      window.setTimeout(() => setClearArmed(false), 3500);
      return;
    }
    clearViewedItems();
    setClearArmed(false);
    setPage(1);
  }

  const title = mode === "viewed" ? copy.viewedTitle : copy.savedTitle;
  const intro = mode === "viewed" ? copy.viewedIntro : copy.savedIntro;
  const countLabel = items.length === 1 ? (mode === "viewed" ? copy.oneViewed : copy.oneSaved) : (mode === "viewed" ? copy.manyViewed : copy.manySaved);

  return <PageShell>
    <main id="main-content" className="favorites-page" data-no-translate lang={language} dir={language === "he" ? "rtl" : "ltr"}>
      <section className="favorites-hero">
        <div className="shell favorites-hero__inner">
          <div><span className="eyebrow">{copy.eyebrow}</span><h1>{title}</h1><p>{intro}</p></div>
          <aside><strong>{items.length}</strong><span>{countLabel}</span><Link href="/account">{copy.account}</Link></aside>
        </div>
      </section>

      <section className={`favorites-content shell${filtering ? " is-filtering" : ""}`} aria-busy={!ready || filtering}>
        <div className="favorites-mode-tabs" role="tablist" aria-label={copy.eyebrow}>
          <button type="button" role="tab" aria-selected={mode === "saved"} className={mode === "saved" ? "active" : ""} onClick={() => selectMode("saved")}><HeartTabIcon /><span>{copy.saved}</span><em>{savedItems.length}</em></button>
          <button type="button" role="tab" aria-selected={mode === "viewed"} className={mode === "viewed" ? "active" : ""} onClick={() => selectMode("viewed")}><EyeTabIcon /><span>{copy.viewed}</span><em>{viewedItems.length}</em></button>
        </div>

        {!ready ? <div className="favorites-loading" role="status"><span aria-hidden="true" /><h2>{mode === "viewed" ? copy.loadingViewed : copy.loadingSaved}</h2><div><i /><i /><i /></div></div> : items.length ? <>
          <div className="favorites-toolbar">
            <nav className="favorites-tabs" aria-label={mode === "viewed" ? copy.filterViewed : copy.filterSaved}>
              <button type="button" className={activeWorld === "all" ? "active" : ""} aria-pressed={activeWorld === "all"} onClick={() => selectWorld("all")}>{copy.all} <span>{items.length}</span></button>
              {availableWorlds.map((world) => <button key={world} type="button" className={activeWorld === world ? "active" : ""} aria-pressed={activeWorld === world} onClick={() => selectWorld(world)}>{labels[world]} <span>{items.filter((item) => item.world === world).length}</span></button>)}
            </nav>
            {mode === "viewed" ? <div className="favorites-history-actions"><small>{copy.deviceNote}</small><button type="button" className={clearArmed ? "is-armed" : ""} onClick={resetViewedHistory}>{clearArmed ? copy.clearConfirm : copy.clear}</button></div> : null}
          </div>
          {filtering ? <div className="favorites-filtering" role="status"><span aria-hidden="true" />{copy.filtering}</div> : null}
          <div className="favorites-grid">
            {visibleItems.map((item) => <article key={item.key} className="favorite-card">
              <Link className="favorite-card__media" href={item.href}>{item.image ? <img src={item.image} alt={translate(item.name)} /> : <span>{translate(item.name).slice(0, 1)}</span>}</Link>
              <FavoriteButton id={item.id} world={item.world} name={item.name} location={item.location} image={item.image} href={item.href} meta={item.meta} />
              <div className="favorite-card__body"><small>{labels[item.world]}</small><h2><Link href={item.href}>{translate(item.name)}</Link></h2><p>{localizeLocation(item.location, translate)}</p>{localizeMeta(item, language) ? <span>{translate(localizeMeta(item, language) || "")}</span> : null}{mode === "viewed" && "viewedAt" in item ? <time dateTime={item.viewedAt}>{copy.viewedAt} {new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.viewedAt))}</time> : null}<Link className="button secondary" href={item.href}>{copy.details}</Link></div>
            </article>)}
          </div>
          {totalPages > 1 ? <nav className="favorites-pagination" aria-label={`${copy.page} ${page}`}>
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{copy.previous}</button>
            <div>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={page === number ? "page" : undefined} className={page === number ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}</div>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{copy.next}</button>
          </nav> : null}
        </> : <div className="favorites-empty">
          <div><span aria-hidden="true">{mode === "viewed" ? <EyeTabIcon /> : "♡"}</span><h2>{mode === "viewed" ? copy.emptyViewedTitle : copy.emptySavedTitle}</h2><p>{mode === "viewed" ? copy.emptyViewedText : copy.emptySavedText}</p></div>
          <div className="favorites-empty__links">
            {[["/search", labels.vacation], ["/events/search", labels.events], ["/spas", labels.spa], ["/providers", labels.providers], ["/hourly", labels.hourly], ["/attractions", labels.activities], ["/trails", labels.trails]].map(([href, label]) => <Link key={href} href={href}><span>{label}</span><span className="favorites-empty__link-arrow" aria-hidden="true">{language === "he" ? "\u2190" : "\u2192"}</span></Link>)}
          </div>
        </div>}
      </section>
      <section className="favorites-account-strip"><div className="shell"><div><h2>{copy.stripTitle}</h2><p>{copy.stripText}</p></div><Link className="button primary" href="/account">{copy.login}</Link></div></section>
    </main>
  </PageShell>;
}
