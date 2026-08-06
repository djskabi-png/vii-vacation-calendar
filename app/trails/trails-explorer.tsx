"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrailCard } from "../components/trail-card";
import { natureTypes, regions, trails, type TrailDifficulty } from "../data/trail-data";
import { ModernSelect } from "../components/modern-select";

const difficulties: Array<"הכל" | TrailDifficulty> = ["הכל", "קל", "בינוני", "למיטיבי לכת"];

export function TrailsExplorer() {
  const searchParams = useSearchParams();
  const requestedRegion = searchParams.get("area") || "הכל";
  const initialRegion = regions.includes(requestedRegion) ? requestedRegion : "הכל";
  const [region, setRegion] = useState(initialRegion);
  const [nature, setNature] = useState("הכל");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("הכל");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => trails.filter((trail) => {
    const searchable = `${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (region === "הכל" || trail.mainArea === region)
      && (nature === "הכל" || trail.nature.includes(nature))
      && (difficulty === "הכל" || trail.difficulty === difficulty)
      && (!query.trim() || searchable.includes(query.trim()));
  }), [region, nature, difficulty, query]);

  return <>
    <form className="trail-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון מסלולי טיול">
      <label><span>חיפוש לפי אזור או מסלול</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לדוגמה: כנרת, מפל, חוף" /></label>
      <ModernSelect label="אזור" value={region} onChange={setRegion} options={regions.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="סוג טבע" value={nature} onChange={setNature} options={natureTypes.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="דרגת קושי" value={difficulty} onChange={(nextValue) => setDifficulty(nextValue as (typeof difficulties)[number])} options={difficulties.map((item) => ({ value: item, label: item }))} />
    </form>
    <div className="trail-results-head"><strong>{filtered.length} מסלולים מתאימים</strong><span>הנתונים נערכו ממקורות רשמיים. מצב המסלול נבדק שוב ביום הטיול.</span></div>
    {filtered.length ? <div className="trail-grid">{filtered.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</div> : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר אחד מהסינונים או לחפש אזור סמוך.</p><button type="button" onClick={() => { setRegion("הכל"); setNature("הכל"); setDifficulty("הכל"); setQuery(""); }}>ניקוי סינונים</button></div>}
  </>;
}
