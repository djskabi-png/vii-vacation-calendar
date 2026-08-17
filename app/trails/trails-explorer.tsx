"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrailCard } from "../components/trail-card";
import { natureTypes, regions, trails, type TrailDifficulty } from "../data/trail-data";
import { DeferredTrailMap } from "../components/deferred-listing-map";
import { useMapViewState } from "../components/map-view-state";
import { MapIcon } from "../site-header";

const difficulties: Array<"הכל" | TrailDifficulty> = ["הכל", "קל", "בינוני", "למיטיבי לכת"];
const regionOptions = regions.filter((item) => item !== "הכל");
const natureOptions = natureTypes.filter((item) => item !== "הכל");
const difficultyOptions = difficulties.filter((item) => item !== "הכל");

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

export function TrailsExplorer() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const [selectedRegions, setSelectedRegions] = useState(() => selectedValues(searchParams.get("area"), regionOptions));
  const [selectedNatures, setSelectedNatures] = useState(() => selectedValues(searchParams.get("nature"), natureOptions));
  const [selectedDifficulties, setSelectedDifficulties] = useState(() => selectedValues(searchParams.get("difficulty"), difficultyOptions));
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const { mapOpen, openMap, closeMap } = useMapViewState();

  const filtered = useMemo(() => trails.filter((trail) => {
    const searchable = `${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (selectedRegions.length === 0 || selectedRegions.includes(trail.mainArea))
      && (selectedNatures.length === 0 || selectedNatures.some((item) => trail.nature.includes(item)))
      && (selectedDifficulties.length === 0 || selectedDifficulties.includes(trail.difficulty))
      && (!query.trim() || searchable.includes(query.trim()));
  }), [selectedRegions, selectedNatures, selectedDifficulties, query]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value && value !== "הכל" ? params.set(key, value) : params.delete(key));
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function toggleValue(value: string, selected: string[], setSelected: (next: string[]) => void, key: string) {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    setSelected(next);
    updateUrl({ [key]: next.join(",") });
  }
  function changeQuery(value: string) { setQuery(value); updateUrl({ q: value.trim() }); }
  function resetFilters() { setSelectedRegions([]); setSelectedNatures([]); setSelectedDifficulties([]); setQuery(""); updateUrl({ area: "", nature: "", difficulty: "", q: "" }); }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      setSelectedRegions(selectedValues(params.get("area"), regionOptions));
      setSelectedNatures(selectedValues(params.get("nature"), natureOptions));
      setSelectedDifficulties(selectedValues(params.get("difficulty"), difficultyOptions));
      setQuery(params.get("q") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  return <>
    <form className="trail-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון מסלולי טיול">
      <label><span>חיפוש לפי אזור או מסלול</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="לדוגמה: כנרת, מפל, חוף" /></label>
      <MultiChoice label="אזור" options={regionOptions} selected={selectedRegions} onToggle={(value) => toggleValue(value, selectedRegions, setSelectedRegions, "area")} />
      <MultiChoice label="סוג טבע" options={natureOptions} selected={selectedNatures} onToggle={(value) => toggleValue(value, selectedNatures, setSelectedNatures, "nature")} />
      <MultiChoice label="דרגת קושי" options={difficultyOptions} selected={selectedDifficulties} onToggle={(value) => toggleValue(value, selectedDifficulties, setSelectedDifficulties, "difficulty")} />
    </form>
    <div className="trail-results-head"><div><strong>{filtered.length} מסלולים מתאימים</strong><span>הנתונים נערכו ממקורות רשמיים. מצב המסלול נבדק שוב ביום הטיול.</span></div>{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לרשימת המסלולים" : "הצגת המסלולים על המפה"} aria-pressed={mapOpen} onClick={() => mapOpen ? closeMap() : openMap()}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לרשימה" : "מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div>
    {filtered.length ? mapOpen ? <div className="airbnb-map-split trail-map-split"><div className="airbnb-map-split__results trail-grid">{filtered.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</div><div className="airbnb-map-split__map"><DeferredTrailMap trails={filtered} autoLoad onClose={closeMap} /></div></div> : <div className="trail-grid">{filtered.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</div> : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר אחד מהסינונים או לחפש אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
