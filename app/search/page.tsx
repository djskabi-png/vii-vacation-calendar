"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListingMap } from "../components/listing-map";
import { ModernSelect } from "../components/modern-select";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { properties } from "../data/site-data";
import { getPlaceAccessibility } from "../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { footerTopicForPropertyType } from "../data/footer-context";
import { cleanAccommodationPath } from "../data/accommodation-landings";
import { matchesSearchLocation, searchLocationOptions } from "../data/search-taxonomy";
import { cleanVacationPath } from "../data/vacation-landings";

export type SearchLandingContext = {
  path: string;
  title: string;
  description: string;
  breadcrumb: string;
  type: string;
  types?: string[];
  resultNoun?: string;
  resultNounOne?: string;
  area?: string;
  listingSlugs?: string[];
  guideTitle?: string;
  guideParagraphs?: string[];
  faqs?: Array<{ question: string; answer: string }>;
};

const legacyAccommodationTypes = [
  { label: "בקתות עץ", matches: ["בקתת עץ", "בקתות עץ"] },
  { label: "וילות", matches: ["וילה", "וילות"] },
  { label: "דירות נופש", matches: ["דירת נופש", "דירות נופש"] },
  { label: "סוויטות", matches: ["סוויטות", "סוויטות יוקרה", "מתחם סוויטות"] },
  { label: "מערות", matches: ["מערה", "מערות"] },
  { label: "צימרים מאבן", matches: ["צימר מאבן", "צימרים מאבן"] },
  { label: "צימרים", matches: ["צימר", "צימרים"] },
  { label: "מתחמי אירוח", matches: ["מתחם אירוח", "מתחמי אירוח", "מתחם נופש", "מתחם סוויטות"] },
  { label: "אוהלים אינדיאנים", matches: ["אוהל אינדיאני", "אוהלים אינדיאנים"] },
] as const;

const legacyExtraFilterGroups = [
  { title: "כללי", options: [
    { id: "accessible", label: "נגישות לנכים", matches: ["נגיש"] },
    { id: "pets", label: "מקבלים בעלי חיים", matches: ["בעלי חיים", "חיות מחמד"] },
    { id: "business-license", label: "רישיון עסק", matches: ["רישיון עסק"] },
    { id: "free-parking", label: "חניה חינם", matches: ["חניה חינם"] },
    { id: "private-units", label: "יחידות", matches: ["יחידות"] },
    { id: "isolated", label: "מבודדת", matches: ["מבודד", "מבודדת"] },
    { id: "religious-complex", label: "מתחמים שומרי שבת", matches: ["שומרי שבת"] },
  ] },
  { title: "מתחם חיצוני", options: [
    { id: "pool", label: "בריכה", matches: ["בריכה"] },
    { id: "covered-heated-pool", label: "בריכת שחייה מחוממת ומקורה", matches: ["בריכה מחוממת ומקורה"] },
    { id: "children-pool", label: "בריכת ילדים", matches: ["בריכת ילדים"] },
    { id: "sauna", label: "סאונה", matches: ["סאונה"] },
    { id: "spa", label: "ספא", matches: ["ספא"] },
    { id: "private-pool", label: "בריכת שחייה פרטית", matches: ["בריכה פרטית"] },
    { id: "current-pool", label: "בריכת זרמים", matches: ["בריכת זרמים"] },
    { id: "jacuzzi", label: "ג׳קוזי", matches: ["ג׳קוזי", "ג'קוזי"] },
    { id: "outdoor-sound", label: "מערכת הגברה", matches: ["מערכת הגברה"] },
    { id: "heated-pool", label: "בריכת שחייה מחוממת", matches: ["בריכה מחוממת"] },
    { id: "fenced-pool", label: "בריכת שחייה מגודרת", matches: ["בריכה מגודרת"] },
    { id: "covered-hot-tub", label: "ג׳קוזי ספא מחומם ומקורה", matches: ["ג׳קוזי ספא מחומם ומקורה", "ג'קוזי ספא מחומם ומקורה"] },
    { id: "barbecue", label: "פינת מנגל", matches: ["מנגל", "ברביקיו"] },
    { id: "steam-sauna", label: "סאונה רטובה", matches: ["סאונה רטובה"] },
  ] },
  { title: "מתחם פנימי", options: [
    { id: "equipped-kitchen", label: "מטבח מאובזר", matches: ["מטבח מאובזר"] },
    { id: "wifi", label: "אינטרנט אלחוטי", matches: ["אינטרנט אלחוטי", "WiFi", "WIFI"] },
    { id: "fireplace", label: "קמין עצים", matches: ["קמין עצים", "קמין"] },
    { id: "projector", label: "מקרן", matches: ["מקרן"] },
    { id: "indoor-jacuzzi", label: "ג׳קוזי", matches: ["ג׳קוזי", "ג'קוזי"] },
    { id: "karaoke", label: "עמדת קריוקי", matches: ["קריוקי"] },
    { id: "indoor-sound", label: "מערכת הגברה", matches: ["מערכת הגברה"] },
    { id: "indoor-spa", label: "ג׳קוזי ספא", matches: ["ג׳קוזי ספא", "ג'קוזי ספא"] },
    { id: "games-room", label: "חדר משחקים", matches: ["חדר משחקים"] },
  ] },
  { title: "קהלי יעד", options: [
    { id: "events", label: "מתאים לאירועים", matches: ["אירועים"] },
    { id: "fun-days", label: "ימי כיף", matches: ["ימי כיף"] },
    { id: "parties", label: "מסיבות", matches: ["מסיבות"] },
    { id: "bachelorette", label: "מסיבות רווקות", matches: ["מסיבת רווקות", "מסיבות רווקות"] },
    { id: "youth", label: "בני נוער", matches: ["בני נוער"] },
    { id: "groom-shabbat", label: "שבתות חתן", matches: ["שבת חתן", "שבתות חתן"] },
    { id: "families", label: "משפחות", matches: ["משפחות", "משפחה"] },
    { id: "team-building", label: "ערבי גיבוש", matches: ["ערבי גיבוש", "יום גיבוש"] },
    { id: "couples-only", label: "סוויטה לזוגות בלבד", matches: ["זוגות בלבד"] },
    { id: "proposals", label: "הצעות נישואין", matches: ["הצעת נישואין", "הצעות נישואין"] },
    { id: "mitzvah", label: "בר או בת מצווה", matches: ["בר מצווה", "בת מצווה"] },
    { id: "groups", label: "קבוצות", matches: ["קבוצות", "קבוצה"] },
    { id: "couples", label: "זוגות", matches: ["זוגות", "זוג"] },
    { id: "birthdays", label: "ימי הולדת", matches: ["יום הולדת", "ימי הולדת"] },
    { id: "bachelor", label: "מסיבת רווקים", matches: ["מסיבת רווקים"] },
    { id: "religious", label: "ציבור דתי", matches: ["ציבור דתי", "שומרי שבת"] },
    { id: "weddings", label: "חתונות", matches: ["חתונה", "חתונות"] },
  ] },
] as const;

const legacyExtraFilters = legacyExtraFilterGroups.flatMap((group) => group.options);

export function SearchExperience({ landing }: { landing?: SearchLandingContext }) {
  const router = useRouter();
  const { language } = useSiteLanguage();
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<"types" | "more">("types");
  const [mapOpen, setMapOpen] = useState(false);
  const [area, setArea] = useState(landing?.area || "הכל");
  const [type, setType] = useState(landing?.type || "הכל");
  const [guests, setGuests] = useState(2);
  const [pool, setPool] = useState(false);
  const [spa, setSpa] = useState(false);
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [visibleMapCount, setVisibleMapCount] = useState(0);

  function updateSearchContext(updates: Record<string, string | null>, nextType = type, nextArea = area) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    const defaultGuests = (params.get("guests") || "2") === "2";
    const hasTemporaryFilters = Array.from(params.keys()).some((key) => !["location", "type", "guests"].includes(key)) || !defaultGuests;
    const cleanPath = nextType !== "הכל" ? cleanAccommodationPath(nextType, nextArea) : cleanVacationPath(nextArea);
    if (cleanPath) {
      params.delete("location");
      params.delete("type");
      if (defaultGuests) params.delete("guests");
    }
    const query = params.toString();
    const path = cleanPath || "/search";
    router.replace(localizedPath(query && (cleanPath || hasTemporaryFilters) ? `${path}?${query}` : path, language), { scroll: false });
  }

  function changeArea(nextArea: string) {
    setArea(nextArea);
    updateSearchContext({ location: nextArea === "הכל" ? "כל הארץ" : nextArea }, type, nextArea);
  }

  function changeGuests(nextGuests: number) {
    setGuests(nextGuests);
    updateSearchContext({ guests: nextGuests === 2 ? null : String(nextGuests) });
  }

  function changeType(nextType: string) {
    setType(nextType);
    updateSearchContext({ type: nextType === "הכל" ? null : nextType }, nextType, area);
  }

  function changeBinaryFilter(key: "pool" | "spa" | "whole" | "accessible", nextValue: boolean) {
    if (key === "pool") setPool(nextValue);
    if (key === "spa") setSpa(nextValue);
    if (key === "whole") setWhole(nextValue);
    if (key === "accessible") setAccessibleOnly(nextValue);
    updateSearchContext({ [key]: nextValue ? "1" : null });
  }

  function toggleExtraFilter(id: string) {
    const nextExtras = selectedExtras.includes(id) ? selectedExtras.filter((item) => item !== id) : [...selectedExtras, id];
    setSelectedExtras(nextExtras);
    updateSearchContext({ features: nextExtras.length ? nextExtras.join(",") : null });
  }

  function changeSort(nextSort: string) {
    setSort(nextSort);
    updateSearchContext({ sort: nextSort === "recommended" ? null : nextSort });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 2);
      const requestedType = params.get("type");
      const requestedPath = requestedType ? cleanAccommodationPath(requestedType, requestedArea || "כל הארץ") : cleanVacationPath(requestedArea || "כל הארץ");
      if (!landing && requestedPath) {
        params.delete("location");
        params.delete("type");
        if (requestedGuests === 2) params.delete("guests");
        const query = params.toString();
        router.replace(localizedPath(query ? `${requestedPath}?${query}` : requestedPath, language), { scroll: false });
        return;
      }
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      else if (landing?.area) setArea(landing.area);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
      if (requestedType) setType(requestedType);
      else if (landing?.type) setType(landing.type);
      setPool(params.get("pool") === "1");
      setSpa(params.get("spa") === "1");
      setWhole(params.get("whole") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      setSelectedExtras((params.get("features") || "").split(",").filter((id) => legacyExtraFilters.some((item) => item.id === id)));
      setSort(["capacity", "units", "name"].includes(params.get("sort") || "") ? params.get("sort") || "recommended" : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [landing, language, router]);

  const areas = useMemo(() => ["הכל", ...searchLocationOptions("vacation").filter((item) => item !== "כל הארץ")], []);
  const mapCandidates = useMemo(() => properties.filter((property) => {
      const legacyType = legacyAccommodationTypes.find((item) => item.label === type);
      const matchesType = type === "הכל" || (landing?.types?.length && type === landing.type ? landing.types.includes(property.type) : legacyType ? legacyType.matches.some((item) => item === property.type) : property.type === type);
      const matchesGuests = property.guests >= guests;
      const matchesPool = !pool || property.features.some((feature) => feature.includes("בריכ"));
      const matchesSpa = !spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה"));
      const matchesWhole = !whole || property.scenario === "single";
      const matchesAccessibility = !accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible";
      const searchableFacts = [property.description, property.type, property.location, property.area, ...property.features].join(" ").toLocaleLowerCase("he");
      const matchesExtras = selectedExtras.every((id) => {
        if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
        const option = legacyExtraFilters.find((item) => item.id === id);
        return option ? option.matches.some((term) => searchableFacts.includes(term.toLocaleLowerCase("he"))) : false;
      });
      return matchesType && matchesGuests && matchesPool && matchesSpa && matchesWhole && matchesAccessibility && matchesExtras;
    }), [accessibleOnly, guests, landing, pool, selectedExtras, spa, type, whole]);

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length && (landing.area ? area === landing.area : area === "הכל"));
    const matches = mapCandidates.filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, area));
    return [...matches].sort((a, b) => {
      if (sort === "capacity") return b.guests - a.guests;
      if (sort === "units") return (b.units || 1) - (a.units || 1);
      if (sort === "name") return a.name.localeCompare(b.name, "he");
      return properties.indexOf(a) - properties.indexOf(b);
    });
  }, [area, landing, mapCandidates, sort]);

  const activeFilters = [
    area !== "הכל" ? { id: "area", label: area, remove: () => changeArea("הכל") } : null,
    type !== "הכל" ? { id: "type", label: type, remove: () => changeType("הכל") } : null,
    guests > 2 ? { id: "guests", label: `${guests} אורחים ומעלה`, remove: () => changeGuests(2) } : null,
    pool ? { id: "pool", label: "בריכה", remove: () => changeBinaryFilter("pool", false) } : null,
    spa ? { id: "spa", label: "ספא וג'קוזי", remove: () => changeBinaryFilter("spa", false) } : null,
    whole ? { id: "whole", label: "מקום שלם", remove: () => changeBinaryFilter("whole", false) } : null,
    accessibleOnly ? { id: "accessible", label: "נגישות מלאה ומאומתת", remove: () => changeBinaryFilter("accessible", false) } : null,
    ...selectedExtras.map((id) => {
      const option = legacyExtraFilters.find((item) => item.id === id);
      return option ? { id: `extra-${id}`, label: option.label, remove: () => toggleExtraFilter(id) } : null;
    }),
  ].filter((filter): filter is { id: string; label: string; remove: () => void } => Boolean(filter));

  const landingResultSummary = landing
    ? `${filtered.length === 1 ? landing.resultNounOne || landing.resultNoun || "מקום אחד" : `${filtered.length} ${landing.resultNoun || "מקומות"}`} ${landing.area ? `ב${landing.area}` : "בישראל"}`
    : null;

  const breadcrumbFilterLabels = [
    area !== "הכל" ? area : null,
    type !== "הכל" ? type : null,
    guests > 2 ? `${guests} אורחים ומעלה` : null,
    ...selectedExtras.map((id) => legacyExtraFilters.find((item) => item.id === id)?.label || null),
  ].filter((item): item is string => Boolean(item));
  const breadcrumbItems = [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: breadcrumbFilterLabels.length || landing ? "/search" : undefined },
    ...(breadcrumbFilterLabels.length || landing ? [{ name: landing?.breadcrumb || breadcrumbFilterLabels.join(" · ") || "תוצאות חיפוש" }] : []),
  ];

  function resetFilters() {
    setArea("הכל");
    setType("הכל");
    setGuests(2);
    setPool(false);
    setSpa(false);
    setWhole(false);
    setAccessibleOnly(false);
    setSelectedExtras([]);
    updateSearchContext({ location: "כל הארץ", guests: null, type: null, pool: null, spa: null, whole: null, accessible: null, features: null, sort: null }, "הכל", "הכל");
  }

  return (
    <PageShell footerTopic={footerTopicForPropertyType(type)}>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact initialLocation={area === "הכל" ? "כל הארץ" : area} initialGuests={guests} basePath={landing?.path} vacationType={type === "הכל" ? undefined : type} /></div>
        <BreadcrumbTrail items={breadcrumbItems} />
        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות">
            <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            <div className="vacation-filter-sections" aria-label="קטגוריות סינון">
              <button type="button" className={filterSection === "types" ? "active" : ""} aria-pressed={filterSection === "types"} onClick={() => setFilterSection("types")}>סוגי אירוח</button>
              <button type="button" className={filterSection === "more" ? "active" : ""} aria-pressed={filterSection === "more"} onClick={() => setFilterSection("more")}>סינונים נוספים</button>
            </div>
            {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
            {filterSection === "types" ? <fieldset className="vacation-type-options"><legend>סוגי אירוח</legend>{legacyAccommodationTypes.map((item) => <label key={item.label}><input type="radio" name="vacation-accommodation-type" checked={type === item.label} onChange={() => changeType(item.label)} /> {item.label}</label>)}</fieldset> : <div className="vacation-more-filters">
              <ModernSelect className={`map-area-select ${mapOpen ? "active" : ""}`} label="אזור" value={area} onChange={changeArea} options={areas.map((item) => ({ value: item, label: item === "הכל" ? "כל הארץ" : item }))} />
              <fieldset><legend>כמות אורחים מינימלית</legend><input type="range" min="1" max="30" value={guests} aria-label="כמות אורחים מינימלית" onChange={(event) => changeGuests(Number(event.target.value))} /><div className="range-value">לפחות {guests} אורחים</div></fieldset>
              <div className="vacation-extra-groups">{legacyExtraFilterGroups.map((group) => <fieldset key={group.title}><legend>{group.title}</legend>{group.options.map((item) => <label key={item.id}><input type="checkbox" checked={selectedExtras.includes(item.id)} onChange={() => toggleExtraFilter(item.id)} /> {item.label}</label>)}</fieldset>)}</div>
            </div>}
            <button type="button" className="button primary filter-apply" onClick={() => setFiltersOpen(false)}>{`הצגת ${filtered.length} מקומות`}</button>
            <button type="button" className="button subtle wide" onClick={resetFilters}>ניקוי סינונים</button>
          </aside>

          <section className="results-list" aria-label="תוצאות">
            <section className="results-heading">
              <div><h1>{landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`)}</h1><p>{landingResultSummary || (mapOpen ? `${visibleMapCount} מקומות באזור המוצג במפה` : area === "הכל" ? `נמצאו ${filtered.length} מקומות` : `נמצאו ${filtered.length} מקומות ב${area}`)}</p></div>
            </section>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className={`button mobile-filter ${activeFilters.length ? "has-filters" : ""}`} aria-expanded={filtersOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFiltersOpen(true); }}><span className="mobile-filter__icon" aria-hidden="true"><i /><i /><i /></span><span>סינון</span>{activeFilters.length ? <b aria-label={`${activeFilters.length} סינונים פעילים`}>{activeFilters.length}</b> : null}</button>{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (!mapOpen) setVisibleMapCount(filtered.length); setMapOpen(!mapOpen); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect compact label="מיון לפי" value={sort} onChange={changeSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "units", label: "מספר יחידות" }, { value: "name", label: "שם המקום" }]} /></div>
            {!mapOpen && <div className="result-cards">{filtered.map((property) => <PropertyCard key={property.slug} property={property} />)}</div>}
            {mapOpen && <ListingMap listings={mapCandidates} initialListings={filtered} autoLoad onClose={() => setMapOpen(false)} onVisibleCountChange={setVisibleMapCount} />}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {landing && filtered.length > 0 && <>
              <section className="accommodation-landing-copy" aria-labelledby="accommodation-guide-title"><div><span className="eyebrow">מידע שימושי לפני שמזמינים</span><h2 id="accommodation-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><p>{landing.description}</p></div><nav className="accommodation-landing-copy__links" aria-label={`מידע על ${landing.breadcrumb}`}><a href="#accommodation-guide">המדריך של העמוד</a><a href="#accommodation-faq">שאלות ותשובות של העמוד</a><Link href="/gift-card">גיפט קארד לחופשה</Link></nav></section>
              <section id="accommodation-guide" className="accommodation-page-guide" aria-labelledby="accommodation-page-guide-title"><span className="eyebrow">המדריך של העמוד</span><h2 id="accommodation-page-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><div>{(landing.guideParagraphs || [landing.description]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
              {landing.faqs?.length ? <section id="accommodation-faq" className="accommodation-page-faq" aria-labelledby="accommodation-page-faq-title"><span className="eyebrow">תשובות ממוקדות לעמוד הזה</span><h2 id="accommodation-page-faq-title">שאלות ותשובות על {landing.breadcrumb}</h2><div>{landing.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
            </>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}

export default function SearchPage() {
  return <SearchExperience />;
}
