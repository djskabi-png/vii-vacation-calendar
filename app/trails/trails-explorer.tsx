"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrailCard } from "../components/trail-card";
import { natureTypes, regions, trails, nearbyTrails, type Trail, type TrailDifficulty } from "../data/trail-data";
import { DeferredTrailMap } from "../components/deferred-listing-map";
import { useMapViewState } from "../components/map-view-state";
import { MapIcon } from "../site-header";
import { ProgressiveResults } from "../components/progressive-results";
import { completeNearbyResults } from "../lib/nearby-recommendations";
import { NearbySearchNotice } from "../components/nearby-search-notice";
import { useSiteLanguage } from "../i18n/locale-provider";
import { ModernSelect } from "../components/modern-select";
import { useDocumentSeed } from "../components/use-document-seed";
import { compareKnownNumbers, discoverySortLabel, discoverySortOptions, orderDiscoveryResults, type DiscoverySortKey } from "../lib/discovery-result-sort";

const difficulties: Array<"הכל" | TrailDifficulty> = ["הכל", "קל", "בינוני", "למיטיבי לכת"];
const regionOptions = regions.filter((item) => item !== "הכל");
const natureOptions = natureTypes.filter((item) => item !== "הכל");
const difficultyOptions = difficulties.filter((item) => item !== "הכל");
type TrailSortKey = DiscoverySortKey | "distance-asc" | "difficulty-asc";

function trailDistance(trail: Trail) {
  const match = trail.distance.replace(/,/g, ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

const difficultyRank: Record<TrailDifficulty, number> = { "קל": 1, "בינוני": 2, "למיטיבי לכת": 3 };

function selectedValues(value: string | null, allowed: string[]) {
  return (value || "").split(",").filter((item) => allowed.includes(item));
}

function MultiChoice({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  const summary = selected.length === 0 ? "הכל" : selected.length === 1 ? selected[0] : `${selected.length} נבחרו`;
  return <details className="trail-multi-select">
    <summary><span>{label}</span><strong>{summary}</strong></summary>
    <div role="group" aria-label={`בחירה מרובה: ${label}`}>
      {options.map((option) => <label key={option} className={selected.includes(option) ? "selected" : ""}><input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} /><span>{option}</span></label>)}
    </div>
  </details>;
}

export function TrailsExplorer({ items = trails, initialFilters }: { items?: Trail[]; initialFilters?: Readonly<Record<string, string>> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const searchQuery = searchParams.toString();
  const [selectedRegions, setSelectedRegions] = useState(() => selectedValues(searchParams.get("area") || initialFilters?.area || null, regionOptions));
  const [selectedNatures, setSelectedNatures] = useState(() => selectedValues(searchParams.get("nature") || initialFilters?.nature || null, natureOptions));
  const [selectedDifficulties, setSelectedDifficulties] = useState(() => selectedValues(searchParams.get("difficulty") || initialFilters?.difficulty || null, difficultyOptions));
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const sortModel = useMemo(() => ({ id: (trail: Trail) => trail.slug, name: (trail: Trail) => trail.name }), []);
  const generalSortOptions = useMemo(() => discoverySortOptions(items, sortModel, language), [items, language, sortModel]);
  const trailSortCopy = language === "he" ? { distance: "המסלולים הקצרים", difficulty: "הקלים קודם" } : language === "en" ? { distance: "Shortest distance", difficulty: "Easiest first" } : language === "ru" ? { distance: "Короткие маршруты", difficulty: "Сначала лёгкие" } : { distance: "Les plus courts", difficulty: "Les plus faciles" };
  const sortOptions = useMemo(() => [generalSortOptions[0], { value: "distance-asc", label: trailSortCopy.distance }, { value: "difficulty-asc", label: trailSortCopy.difficulty }, ...generalSortOptions.slice(1)], [generalSortOptions, trailSortCopy.difficulty, trailSortCopy.distance]);
  const requestedSort = searchParams.get("sort") || "recommended";
  const [sort, setSort] = useState<TrailSortKey>(sortOptions.some((option) => option.value === requestedSort) ? requestedSort as TrailSortKey : "recommended");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const [visibleMapCount, setVisibleMapCount] = useState(0);
  const [activeMapPlaceId, setActiveMapPlaceId] = useState<string | null>(null);
  const mapFilterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedNatures.length) params.set("nature", selectedNatures.join(","));
    if (selectedDifficulties.length) params.set("difficulty", selectedDifficulties.join(","));
    if (query.trim()) params.set("q", query.trim());
    return params.toString();
  }, [selectedNatures, selectedDifficulties, query]);

  const filtered = useMemo(() => items.filter((trail) => {
    const searchable = `${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (selectedRegions.length === 0 || selectedRegions.includes(trail.mainArea))
      && (selectedNatures.length === 0 || selectedNatures.some((item) => trail.nature.includes(item)))
      && (selectedDifficulties.length === 0 || selectedDifficulties.includes(trail.difficulty))
      && (!query.trim() || searchable.includes(query.trim()));
  }), [items, selectedRegions, selectedNatures, selectedDifficulties, query]);
  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= 3 || selectedRegions.length === 0) return [];
    const eligible = items.filter((trail) => {
      if (selectedNatures.length && !selectedNatures.some((item) => trail.nature.includes(item))) return false;
      if (selectedDifficulties.length && !selectedDifficulties.includes(trail.difficulty)) return false;
      if (query.trim() && !`${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`.includes(query.trim())) return false;
      return true;
    });
    return nearbyTrails(selectedRegions[0], "", eligible.length, { inventory: eligible });
  }, [filtered, items, query, selectedDifficulties, selectedNatures, selectedRegions]);
  const resultTrails = useMemo(() => {
    const complete = completeNearbyResults(filtered, nearbyRecovery, (trail) => trail.slug);
    if (sort === "distance-asc") return [...complete].sort((first, second) => compareKnownNumbers(trailDistance(first), trailDistance(second), "asc") || first.name.localeCompare(second.name, "he"));
    if (sort === "difficulty-asc") return [...complete].sort((first, second) => difficultyRank[first.difficulty] - difficultyRank[second.difficulty] || compareKnownNumbers(trailDistance(first), trailDistance(second), "asc") || first.name.localeCompare(second.name, "he"));
    return orderDiscoveryResults(complete, sort, `${documentSeed}:trail-search`, { ...sortModel, priority: trail => query.trim() && !trail.name.includes(query.trim()) ? 1 : 0 });
  }, [documentSeed, filtered, nearbyRecovery, query, sort, sortModel]);
  const displayedTrails = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultTrails;
    const visible = new Set(mapVisibleIds);
    return resultTrails.filter((trail) => visible.has(trail.slug) || visible.has(`trails-${trail.mainArea}`));
  }, [mapOpen, mapVisibleIds, resultTrails]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(initialFilters || {}).forEach(([key, value]) => { if (!params.has(key)) params.set(key, value); });
    Object.entries(updates).forEach(([key, value]) => value && value !== "הכל" ? params.set(key, value) : params.delete(key));
    const basePath = window.location.pathname.replace(/\/explore\/[^/]+\/?$/, "");
    if (basePath !== window.location.pathname) router.push(`${basePath}${params.size ? `?${params}` : ""}`, { scroll: false });
    else window.history.pushState(null, "", `${basePath}${params.size ? `?${params}` : ""}`);
  }

  function toggleValue(value: string, selected: string[], setSelected: (next: string[]) => void, key: string) {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    setSelected(next);
    updateUrl({ [key]: next.join(",") });
  }
  function changeQuery(value: string) { setQuery(value); updateUrl({ q: value.trim() }); }
  function changeSort(value: string) { const next = sortOptions.some((option) => option.value === value) ? value as TrailSortKey : "recommended"; setSort(next); updateUrl({ sort: next === "recommended" ? "" : next }); }
  function resetFilters() { setSelectedRegions([]); setSelectedNatures([]); setSelectedDifficulties([]); setQuery(""); setSort("recommended"); updateUrl({ area: "", nature: "", difficulty: "", q: "", sort: "" }); }

  useEffect(() => {
    const timer = window.setTimeout(() => { setMapVisibleIds(null); setActiveMapPlaceId(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedRegions, selectedNatures, selectedDifficulties, query, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      setSelectedRegions(selectedValues(params.get("area") || initialFilters?.area || null, regionOptions));
      setSelectedNatures(selectedValues(params.get("nature") || initialFilters?.nature || null, natureOptions));
      setSelectedDifficulties(selectedValues(params.get("difficulty") || initialFilters?.difficulty || null, difficultyOptions));
      setQuery(params.get("q") || "");
      const nextSort = params.get("sort") || "recommended";
      setSort(sortOptions.some((option) => option.value === nextSort) ? nextSort as TrailSortKey : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, initialFilters, sortOptions]);

  return <>
    <form className="trail-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון מסלולי טיול">
      <label><span>חיפוש לפי אזור או מסלול</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="לדוגמה: כנרת, מפל, חוף" /></label>
      <MultiChoice label="אזור" options={regionOptions} selected={selectedRegions} onToggle={(value) => toggleValue(value, selectedRegions, setSelectedRegions, "area")} />
      <MultiChoice label="סוג טבע" options={natureOptions} selected={selectedNatures} onToggle={(value) => toggleValue(value, selectedNatures, setSelectedNatures, "nature")} />
      <MultiChoice label="דרגת קושי" options={difficultyOptions} selected={selectedDifficulties} onToggle={(value) => toggleValue(value, selectedDifficulties, setSelectedDifficulties, "difficulty")} />
    </form>
    {resultTrails.length > filtered.length && <NearbySearchNotice regionalOnly />}
    <div className="trail-results-head"><div><strong>{language === "he" ? mapOpen ? `${visibleMapCount} מסלולים באזור המוצג במפה` : `${resultTrails.length} מסלולים מתאימים` : language === "en" ? `Trails${mapOpen ? " in the map area" : " found"}: ${mapOpen ? visibleMapCount : resultTrails.length}` : language === "ru" ? `Маршруты${mapOpen ? " в области карты" : " по вашему запросу"}: ${mapOpen ? visibleMapCount : resultTrails.length}` : `Itinéraires${mapOpen ? " dans la zone affichée" : " trouvés"} : ${mapOpen ? visibleMapCount : resultTrails.length}`}</strong><span>הנתונים נערכו ממקורות רשמיים. מצב המסלול נבדק שוב ביום הטיול.</span></div><div className="trail-results-head__actions"><ModernSelect compact label={discoverySortLabel(language)} value={sort} onChange={changeSort} options={sortOptions} />{resultTrails.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לרשימת המסלולים" : "הצגת המסלולים על המפה"} aria-pressed={mapOpen} onClick={() => { setMapVisibleIds(null); setActiveMapPlaceId(null); if (mapOpen) closeMap(); else { setVisibleMapCount(resultTrails.length); openMap(); } }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לרשימה" : "מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div></div>
    {resultTrails.length ? mapOpen ? <div className="airbnb-map-split trail-map-split"><div className="airbnb-map-split__results trail-grid">{displayedTrails.map((trail) => <TrailCard key={trail.slug} trail={trail} mapActive={activeMapPlaceId === trail.slug || activeMapPlaceId === `trails-${trail.mainArea}`} onActiveChange={(active) => setActiveMapPlaceId(active ? trail.slug : null)} />)}</div><div className="airbnb-map-split__map"><DeferredTrailMap trails={resultTrails} filterQuery={mapFilterQuery} autoLoad onClose={() => { setMapVisibleIds(null); setActiveMapPlaceId(null); closeMap(); }} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPlaceId} onActivePlaceChange={setActiveMapPlaceId} /></div></div> : <ProgressiveResults className="trail-grid" kind="trails" resetKey={`${selectedRegions.join(",")}|${selectedNatures.join(",")}|${selectedDifficulties.join(",")}|${query}|${sort}`}>{resultTrails.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</ProgressiveResults> : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר אחד מהסינונים או לחפש אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
