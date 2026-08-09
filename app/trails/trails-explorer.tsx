"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrailCard } from "../components/trail-card";
import { natureTypes, regions, trails, type TrailDifficulty } from "../data/trail-data";
import { ModernSelect } from "../components/modern-select";

const difficulties: Array<"הכל" | TrailDifficulty> = ["הכל", "קל", "בינוני", "למיטיבי לכת"];

export function TrailsExplorer() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const requestedRegion = searchParams.get("area") || "הכל";
  const initialRegion = regions.includes(requestedRegion) ? requestedRegion : "הכל";
  const [region, setRegion] = useState(initialRegion);
  const requestedNature = searchParams.get("nature") || "הכל";
  const requestedDifficulty = searchParams.get("difficulty") || "הכל";
  const [nature, setNature] = useState(natureTypes.includes(requestedNature) ? requestedNature : "הכל");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>(difficulties.includes(requestedDifficulty as (typeof difficulties)[number]) ? requestedDifficulty as (typeof difficulties)[number] : "הכל");
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const filtered = useMemo(() => trails.filter((trail) => {
    const searchable = `${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (region === "הכל" || trail.mainArea === region)
      && (nature === "הכל" || trail.nature.includes(nature))
      && (difficulty === "הכל" || trail.difficulty === difficulty)
      && (!query.trim() || searchable.includes(query.trim()));
  }), [region, nature, difficulty, query]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value && value !== "הכל" ? params.set(key, value) : params.delete(key));
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function changeRegion(value: string) { setRegion(value); updateUrl({ area: value }); }
  function changeNature(value: string) { setNature(value); updateUrl({ nature: value }); }
  function changeDifficulty(value: string) { setDifficulty(value as (typeof difficulties)[number]); updateUrl({ difficulty: value }); }
  function changeQuery(value: string) { setQuery(value); updateUrl({ q: value.trim() }); }
  function resetFilters() { setRegion("הכל"); setNature("הכל"); setDifficulty("הכל"); setQuery(""); updateUrl({ area: "", nature: "", difficulty: "", q: "" }); }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      const nextRegion = params.get("area") || "הכל";
      const nextNature = params.get("nature") || "הכל";
      const nextDifficulty = params.get("difficulty") || "הכל";
      setRegion(regions.includes(nextRegion) ? nextRegion : "הכל");
      setNature(natureTypes.includes(nextNature) ? nextNature : "הכל");
      setDifficulty(difficulties.includes(nextDifficulty as (typeof difficulties)[number]) ? nextDifficulty as (typeof difficulties)[number] : "הכל");
      setQuery(params.get("q") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  return <>
    <form className="trail-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון מסלולי טיול">
      <label><span>חיפוש לפי אזור או מסלול</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="לדוגמה: כנרת, מפל, חוף" /></label>
      <ModernSelect label="אזור" value={region} onChange={changeRegion} options={regions.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="סוג טבע" value={nature} onChange={changeNature} options={natureTypes.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="דרגת קושי" value={difficulty} onChange={changeDifficulty} options={difficulties.map((item) => ({ value: item, label: item }))} />
    </form>
    <div className="trail-results-head"><strong>{filtered.length} מסלולים מתאימים</strong><span>הנתונים נערכו ממקורות רשמיים. מצב המסלול נבדק שוב ביום הטיול.</span></div>
    {filtered.length ? <div className="trail-grid">{filtered.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</div> : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר אחד מהסינונים או לחפש אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
