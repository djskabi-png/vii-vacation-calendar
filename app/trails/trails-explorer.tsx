"use client";

import { useMemo, useState } from "react";
import { TrailCard } from "../components/trail-card";
import { natureTypes, regions, trails, type TrailDifficulty } from "../data/trail-data";

const difficulties: Array<"הכל" | TrailDifficulty> = ["הכל", "קל", "בינוני", "למיטיבי לכת"];

export function TrailsExplorer() {
  const [region, setRegion] = useState("הכל");
  const [nature, setNature] = useState("הכל");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("הכל");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => trails.filter((trail) => {
    const searchable = `${trail.name} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (region === "הכל" || trail.region === region)
      && (nature === "הכל" || trail.nature.includes(nature))
      && (difficulty === "הכל" || trail.difficulty === difficulty)
      && (!query.trim() || searchable.includes(query.trim()));
  }), [region, nature, difficulty, query]);

  return <>
    <form className="trail-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון מסלולי טיול">
      <label><span>חיפוש לפי אזור או מסלול</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לדוגמה: כנרת, מפל, חוף" /></label>
      <label><span>אזור</span><select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>סוג טבע</span><select value={nature} onChange={(event) => setNature(event.target.value)}>{natureTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>דרגת קושי</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as (typeof difficulties)[number])}>{difficulties.map((item) => <option key={item}>{item}</option>)}</select></label>
    </form>
    <div className="trail-results-head"><strong>{filtered.length} מסלולים מתאימים</strong><span>הנתונים נערכו ממקורות רשמיים. מצב המסלול נבדק שוב ביום הטיול.</span></div>
    {filtered.length ? <div className="trail-grid">{filtered.map((trail) => <TrailCard key={trail.slug} trail={trail} />)}</div> : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר אחד מהסינונים או לחפש אזור סמוך.</p><button type="button" onClick={() => { setRegion("הכל"); setNature("הכל"); setDifficulty("הכל"); setQuery(""); }}>ניקוי סינונים</button></div>}
  </>;
}
