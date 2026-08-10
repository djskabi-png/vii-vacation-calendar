"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DeferredListingMap } from "../components/deferred-listing-map";
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
import { buildVacationSearchUrl } from "../lib/vacation-search-url";
import { vacationInventorySummary } from "../lib/vacation-inventory";
import { useMapViewState } from "../components/map-view-state";

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

type VacationFilterState = {
  area: string;
  selectedTypes: string[];
  guests: number;
  pool: boolean;
  spa: boolean;
  whole: boolean;
  accessibleOnly: boolean;
  selectedExtras: string[];
  sort: string;
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

function normalizeAccommodationType(value: string) {
  const option = legacyAccommodationTypes.find((item) => item.label === value || item.matches.some((match) => match === value));
  return option?.label || value;
}

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

type LegacyExtraFilter = { id: string; label: string; matches: readonly string[] };
const legacyExtraFilters = legacyExtraFilterGroups.reduce<LegacyExtraFilter[]>((items, group) => [...items, ...group.options], []);

export function SearchExperience({ landing }: { landing?: SearchLandingContext }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const { language } = useSiteLanguage();
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<"types" | "more">("types");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const [area, setArea] = useState(landing?.area || "הכל");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(landing?.type ? [normalizeAccommodationType(landing.type)] : []);
  const [guests, setGuests] = useState(2);
  const [pool, setPool] = useState(false);
  const [spa, setSpa] = useState(false);
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [draftFilters, setDraftFilters] = useState<VacationFilterState | null>(null);
  const [, setVisibleMapCount] = useState(0);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);

  function updateSearchContext(updates: Record<string, string | null>, nextTypes = selectedTypes, nextArea = area) {
    const nextUrl = buildVacationSearchUrl(window.location.search, updates, nextTypes, nextArea);
    router.push(localizedPath(nextUrl, language), { scroll: false });
  }

  function currentFilterState(): VacationFilterState {
    return { area, selectedTypes, guests, pool, spa, whole, accessibleOnly, selectedExtras, sort };
  }

  function openFiltersPanel() {
    setDraftFilters(currentFilterState());
    setFiltersOpen(true);
  }

  function closeFiltersPanel() {
    setDraftFilters(null);
    setFiltersOpen(false);
  }

  function changeArea(nextArea: string) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, area: nextArea });
      return;
    }
    setArea(nextArea);
    updateSearchContext({ location: nextArea === "הכל" ? "כל הארץ" : nextArea }, selectedTypes, nextArea);
  }

  function changeGuests(nextGuests: number) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, guests: nextGuests });
      return;
    }
    setGuests(nextGuests);
    updateSearchContext({ guests: nextGuests === 2 ? null : String(nextGuests) });
  }

  function toggleType(nextType: string) {
    if (filtersOpen && draftFilters) {
      const nextTypes = draftFilters.selectedTypes.includes(nextType)
        ? draftFilters.selectedTypes.filter((item) => item !== nextType)
        : [...draftFilters.selectedTypes, nextType];
      setDraftFilters({ ...draftFilters, selectedTypes: nextTypes });
      return;
    }
    const currentTypes = selectedTypes.length
      ? selectedTypes
      : landing?.type ? [normalizeAccommodationType(landing.type)] : [];
    const nextTypes = currentTypes.includes(nextType)
      ? currentTypes.filter((item) => item !== nextType)
      : [...currentTypes, nextType];
    setSelectedTypes(nextTypes);
    updateSearchContext({ type: null, types: nextTypes.length > 1 ? nextTypes.join(",") : null }, nextTypes, area);
  }

  function changeBinaryFilter(key: "pool" | "spa" | "whole" | "accessible", nextValue: boolean) {
    if (filtersOpen && draftFilters) {
      const field = key === "accessible" ? "accessibleOnly" : key;
      setDraftFilters({ ...draftFilters, [field]: nextValue });
      return;
    }
    if (key === "pool") setPool(nextValue);
    if (key === "spa") setSpa(nextValue);
    if (key === "whole") setWhole(nextValue);
    if (key === "accessible") setAccessibleOnly(nextValue);
    updateSearchContext({ [key]: nextValue ? "1" : null });
  }

  function toggleExtraFilter(id: string) {
    if (filtersOpen && draftFilters) {
      const nextExtras = draftFilters.selectedExtras.includes(id) ? draftFilters.selectedExtras.filter((item) => item !== id) : [...draftFilters.selectedExtras, id];
      setDraftFilters({ ...draftFilters, selectedExtras: nextExtras });
      return;
    }
    const nextExtras = selectedExtras.includes(id) ? selectedExtras.filter((item) => item !== id) : [...selectedExtras, id];
    setSelectedExtras(nextExtras);
    updateSearchContext({ features: nextExtras.length ? nextExtras.join(",") : null });
  }

  function changeSort(nextSort: string) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, sort: nextSort });
      return;
    }
    setSort(nextSort);
    updateSearchContext({ sort: nextSort === "recommended" ? null : nextSort });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || (Number(params.get("adults") || 2) + Number(params.get("children") || 0)));
      const requestedType = params.get("type");
      const requestedTypes = (params.get("types") || requestedType || "")
        .split(",")
        .map(normalizeAccommodationType)
        .filter((label) => legacyAccommodationTypes.some((item) => item.label === label));
      const requestedPath = requestedTypes.length === 1
        ? cleanAccommodationPath(requestedTypes[0], requestedArea || "כל הארץ")
        : cleanVacationPath(requestedArea || "כל הארץ");
      if (!landing && requestedPath) {
        params.delete("location");
        params.delete("type");
        if (requestedTypes.length <= 1) params.delete("types");
        if (requestedGuests === 2) params.delete("guests");
        const query = params.toString();
        router.replace(localizedPath(query ? `${requestedPath}?${query}` : requestedPath, language), { scroll: false });
        return;
      }
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      else if (landing?.area) setArea(landing.area);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
      if (requestedTypes.length) setSelectedTypes(requestedTypes);
      else if (landing?.type) setSelectedTypes([normalizeAccommodationType(landing.type)]);
      else setSelectedTypes([]);
      setPool(params.get("pool") === "1");
      setSpa(params.get("spa") === "1");
      setWhole(params.get("whole") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      setSelectedExtras((params.get("features") || "").split(",").filter((id) => legacyExtraFilters.some((item) => item.id === id)));
      setSort(["capacity", "units", "name"].includes(params.get("sort") || "") ? params.get("sort") || "recommended" : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [landing, language, router, searchQuery]);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFiltersPanel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

  const shownFilters = filtersOpen && draftFilters ? draftFilters : currentFilterState();

  const areas = useMemo(() => ["הכל", ...searchLocationOptions("vacation").filter((item) => item !== "כל הארץ")], []);
  const mapCandidates = useMemo(() => properties.filter((property) => {
      const matchesType = selectedTypes.length === 0 || selectedTypes.some((selectedType) => {
        const legacyType = legacyAccommodationTypes.find((item) => item.label === selectedType);
        if (landing?.types?.length && selectedType === landing.type) return landing.types.includes(property.type);
        return legacyType ? legacyType.matches.some((item) => item === property.type) : property.type === selectedType;
      });
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
    }), [accessibleOnly, guests, landing, pool, selectedExtras, selectedTypes, spa, whole]);

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landing.type || (selectedTypes.length === 1 && selectedTypes[0] === normalizeAccommodationType(landing.type)))
      && (landing.area ? area === landing.area : area === "הכל"));
    const matches = mapCandidates.filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, area));
    return [...matches].sort((a, b) => {
      if (sort === "capacity") return b.guests - a.guests;
      if (sort === "units") return (b.units || 1) - (a.units || 1);
      if (sort === "name") return a.name.localeCompare(b.name, "he");
      return properties.indexOf(a) - properties.indexOf(b);
    });
  }, [area, landing, mapCandidates, selectedTypes, sort]);

  const draftCandidates = properties.filter((property) => {
    const matchesType = shownFilters.selectedTypes.length === 0 || shownFilters.selectedTypes.some((selectedType) => {
      const legacyType = legacyAccommodationTypes.find((item) => item.label === selectedType);
      if (landing?.types?.length && selectedType === landing.type) return landing.types.includes(property.type);
      return legacyType ? legacyType.matches.some((item) => item === property.type) : property.type === selectedType;
    });
    const searchableFacts = [property.description, property.type, property.location, property.area, ...property.features].join(" ").toLocaleLowerCase("he");
    const matchesExtras = shownFilters.selectedExtras.every((id) => {
      if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
      const option = legacyExtraFilters.find((item) => item.id === id);
      return option ? option.matches.some((term) => searchableFacts.includes(term.toLocaleLowerCase("he"))) : false;
    });
    return matchesType
      && property.guests >= shownFilters.guests
      && (!shownFilters.pool || property.features.some((feature) => feature.includes("בריכ")))
      && (!shownFilters.spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה")))
      && (!shownFilters.whole || property.scenario === "single")
      && (!shownFilters.accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible")
      && matchesExtras;
  });
  const draftUsesLandingSet = Boolean(landing?.listingSlugs?.length
    && (!landing.type || (shownFilters.selectedTypes.length === 1 && shownFilters.selectedTypes[0] === normalizeAccommodationType(landing.type)))
    && (landing.area ? shownFilters.area === landing.area : shownFilters.area === "הכל"));
  const draftResultCount = draftCandidates.filter((property) => draftUsesLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, shownFilters.area)).length;
  const draftResultLabel = draftResultCount === 1 ? "הצגת מקום אחד" : `הצגת ${draftResultCount} מקומות`;

  const displayedResults = useMemo(() => {
    if (!mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return mapCandidates.filter((property) => visible.has(property.slug)).sort((a, b) => {
      if (sort === "capacity") return b.guests - a.guests;
      if (sort === "units") return (b.units || 1) - (a.units || 1);
      if (sort === "name") return a.name.localeCompare(b.name, "he");
      return properties.indexOf(a) - properties.indexOf(b);
    });
  }, [filtered, mapCandidates, mapVisibleIds, sort]);
  const inventorySummary = useMemo(() => vacationInventorySummary(displayedResults, language), [displayedResults, language]);
  const selectedStay = useMemo(() => {
    const from = searchParams.get("from");
    const till = searchParams.get("till");
    return from && till ? { from, till } : null;
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [area, selectedTypes, guests, pool, spa, whole, accessibleOnly, selectedExtras, sort]);

  const activeFilters = [
    area !== "הכל" ? { id: "area", label: area, remove: () => changeArea("הכל") } : null,
    ...selectedTypes.map((selectedType) => ({ id: `type-${selectedType}`, label: selectedType, remove: () => toggleType(selectedType) })),
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

  const breadcrumbFilterLabels = [
    area !== "הכל" ? area : null,
    ...selectedTypes,
    guests > 2 ? `${guests} אורחים ומעלה` : null,
    ...selectedExtras.map((id) => legacyExtraFilters.find((item) => item.id === id)?.label || null),
  ].filter((item): item is string => Boolean(item));
  const breadcrumbItems = [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: breadcrumbFilterLabels.length || landing ? "/search" : undefined },
    ...(breadcrumbFilterLabels.length || landing ? [{ name: landing?.breadcrumb || breadcrumbFilterLabels.join(" · ") || "תוצאות חיפוש" }] : []),
  ];

  function resetFilters() {
    if (filtersOpen) {
      setDraftFilters({ area: "הכל", selectedTypes: [], guests: 2, pool: false, spa: false, whole: false, accessibleOnly: false, selectedExtras: [], sort: "recommended" });
      return;
    }
    setArea("הכל");
    setSelectedTypes([]);
    setGuests(2);
    setPool(false);
    setSpa(false);
    setWhole(false);
    setAccessibleOnly(false);
    setSelectedExtras([]);
    updateSearchContext({ location: "כל הארץ", guests: null, type: null, types: null, pool: null, spa: null, whole: null, accessible: null, features: null, sort: null }, [], "הכל");
  }

  function applyFilters() {
    if (!draftFilters) {
      closeFiltersPanel();
      return;
    }
    setArea(draftFilters.area);
    setSelectedTypes(draftFilters.selectedTypes);
    setGuests(draftFilters.guests);
    setPool(draftFilters.pool);
    setSpa(draftFilters.spa);
    setWhole(draftFilters.whole);
    setAccessibleOnly(draftFilters.accessibleOnly);
    setSelectedExtras(draftFilters.selectedExtras);
    setSort(draftFilters.sort);
    updateSearchContext({
      location: draftFilters.area === "הכל" ? "כל הארץ" : draftFilters.area,
      type: null,
      types: draftFilters.selectedTypes.length > 1 ? draftFilters.selectedTypes.join(",") : null,
      guests: draftFilters.guests === 2 ? null : String(draftFilters.guests),
      pool: draftFilters.pool ? "1" : null,
      spa: draftFilters.spa ? "1" : null,
      whole: draftFilters.whole ? "1" : null,
      accessible: draftFilters.accessibleOnly ? "1" : null,
      features: draftFilters.selectedExtras.length ? draftFilters.selectedExtras.join(",") : null,
      sort: draftFilters.sort === "recommended" ? null : draftFilters.sort,
    }, draftFilters.selectedTypes, draftFilters.area);
    closeFiltersPanel();
  }

  return (
    <PageShell footerTopic={footerTopicForPropertyType(selectedTypes[0] || "הכל")}>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact initialLocation={area === "הכל" ? "כל הארץ" : area} initialGuests={guests} basePath={selectedTypes.length <= 1 ? landing?.path : undefined} vacationType={selectedTypes.length === 1 ? selectedTypes[0] : undefined} /></div>
        <BreadcrumbTrail items={breadcrumbItems} />
        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות" role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen || undefined}>
            <div className="filter-panel__scroll">
              <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={closeFiltersPanel} aria-label="סגירה"><CloseIcon /></button></div>
              <div className="vacation-filter-sections" aria-label="קטגוריות סינון">
                <button type="button" className={filterSection === "types" ? "active" : ""} aria-pressed={filterSection === "types"} onClick={() => setFilterSection("types")}>סוגי אירוח</button>
                <button type="button" className={filterSection === "more" ? "active" : ""} aria-pressed={filterSection === "more"} onClick={() => setFilterSection("more")}>סינונים נוספים</button>
              </div>
              <div className="filter-panel__mobile-sort">
                <ModernSelect label="מיון לפי" value={shownFilters.sort} onChange={changeSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "units", label: "מספר יחידות" }, { value: "name", label: "שם המקום" }]} />
              </div>
              {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
              {filterSection === "types" ? <fieldset className="vacation-type-options"><legend>סוגי אירוח, אפשר לבחור כמה אפשרויות</legend>{legacyAccommodationTypes.map((item) => <label key={item.label}><input type="checkbox" checked={shownFilters.selectedTypes.includes(item.label)} onChange={() => toggleType(item.label)} /> {item.label}</label>)}</fieldset> : <div className="vacation-more-filters">
                <ModernSelect className={`map-area-select ${mapOpen ? "active" : ""}`} label="אזור" value={shownFilters.area} onChange={changeArea} options={areas.map((item) => ({ value: item, label: item === "הכל" ? "כל הארץ" : item }))} />
                <fieldset><legend>כמות אורחים מינימלית</legend><input type="range" min="1" max="30" value={shownFilters.guests} aria-label="כמות אורחים מינימלית" onChange={(event) => changeGuests(Number(event.target.value))} /><div className="range-value">לפחות {shownFilters.guests} אורחים</div></fieldset>
                <div className="vacation-extra-groups">{legacyExtraFilterGroups.map((group) => <fieldset key={group.title}><legend>{group.title}</legend>{group.options.map((item) => <label key={item.id}><input type="checkbox" checked={shownFilters.selectedExtras.includes(item.id)} onChange={() => toggleExtraFilter(item.id)} /> {item.label}</label>)}</fieldset>)}</div>
              </div>}
            </div>
            <div className="filter-panel__actions">
              <button type="button" className="button primary filter-apply" onClick={applyFilters}>{draftResultLabel}</button>
              <button type="button" className="button subtle wide filter-reset" onClick={resetFilters}>ניקוי סינונים</button>
            </div>
          </aside>

          <section className="results-list" aria-label="תוצאות">
            <section className="results-heading">
              <div><h1>{landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`)}</h1><div className="results-heading__meta"><p className="results-heading__inventory" aria-live="polite">{inventorySummary}</p><button type="button" className={`mobile-filter mobile-filter--compact ${activeFilters.length ? "has-filters" : ""}`} aria-label="סינון" aria-expanded={filtersOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openFiltersPanel(); }}><span className="mobile-filter__icon" aria-hidden="true"><i /><i /><i /></span><span className="mobile-filter__label">סינון</span>{activeFilters.length ? <b aria-label={`${activeFilters.length} סינונים פעילים`}>{activeFilters.length}</b> : null}</button></div></div>
            </section>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            <div className="results-toolbar"><div className="results-toolbar__actions">{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeMap(); else { setVisibleMapCount(filtered.length); openMap(); } }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={changeSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "units", label: "מספר יחידות" }, { value: "name", label: "שם המקום" }]} /></div>
            {!mapOpen && <div className="result-cards">{displayedResults.map((property) => <PropertyCard key={property.slug} property={property} selectedStay={selectedStay} />)}</div>}
            {mapOpen && <DeferredListingMap listings={mapCandidates} initialListings={filtered} autoLoad onClose={closeMap} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} />}
            {(mapVisibleIds ? displayedResults.length === 0 : filtered.length === 0) && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {landing && filtered.length > 0 && <>
              <section className="accommodation-landing-copy" aria-labelledby="accommodation-guide-title"><div><span className="eyebrow">מידע שימושי לפני שמזמינים</span><h2 id="accommodation-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><p>{landing.description}</p></div><nav className="accommodation-landing-copy__links" aria-label={`מידע על ${landing.breadcrumb}`}><a href="#accommodation-guide">המדריך של העמוד</a><a href="#accommodation-faq">שאלות ותשובות של העמוד</a><Link href="/gift-card">גיפט קארד לחופשה</Link></nav></section>
              <section id="accommodation-guide" className="accommodation-page-guide" aria-labelledby="accommodation-page-guide-title"><span className="eyebrow">המדריך של העמוד</span><h2 id="accommodation-page-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><div>{(landing.guideParagraphs || [landing.description]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
              {landing.faqs?.length ? <section id="accommodation-faq" className="accommodation-page-faq" aria-labelledby="accommodation-page-faq-title"><span className="eyebrow">תשובות ממוקדות לעמוד הזה</span><h2 id="accommodation-page-faq-title">שאלות ותשובות על {landing.breadcrumb}</h2><div>{landing.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
            </>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={closeFiltersPanel} />}
      </main>
    </PageShell>
  );
}

export default function SearchPage() {
  return <SearchExperience />;
}
