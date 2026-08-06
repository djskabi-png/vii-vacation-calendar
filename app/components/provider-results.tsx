"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { DiscoveryCard } from "./discovery-card";
import { ModernSelect } from "./modern-select";

const categories = [
  { id: "all", label: "הכל" },
  { id: "food", label: "שפים ואוכל", tokens: ["שף", "קייטרינג"] },
  { id: "music", label: "מוזיקה", tokens: ["תקליטן", "מוזיקלי", "DJ"] },
  { id: "photo", label: "צילום", tokens: ["צילום", "סטילס", "וידאו"] },
  { id: "design", label: "עיצוב", tokens: ["בלונים", "קונספט", "עיצוב"] },
  { id: "bar", label: "ברים", tokens: ["בר ", "קוקטייל", "מיקסולוגיה"] },
  { id: "wellness", label: "רווחה ותנועה", tokens: ["יוגה", "נשימה", "עיסוי", "רווחה"] },
] as const;

export function ProviderResults({ items }: { items: DiscoveryItem[] }) {
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("category") || "all";
  const initialCategory = categories.some((entry) => entry.id === requestedCategory) ? requestedCategory : "all";
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("כל הארץ");
  const regions = useMemo(() => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => item.serviceAreas || [item.area])))], [items]);
  const filtered = useMemo(() => {
    const selected = categories.find((entry) => entry.id === category);
    const normalized = query.trim().toLocaleLowerCase("he");
    return items.filter((item) => {
      const text = `${item.name} ${(item.searchTerms || []).join(" ")} ${item.area} ${item.description} ${item.features.join(" ")}`;
      const matchesCategory = !selected || selected.id === "all" || selected.tokens.some((token) => text.includes(token));
      const matchesQuery = !normalized || text.toLocaleLowerCase("he").includes(normalized);
      const matchesRegion = region === "כל הארץ" || (item.serviceAreas || [item.area]).includes(region);
      return matchesCategory && matchesQuery && matchesRegion;
    });
  }, [category, items, query, region]);

  return <div className="provider-results">
    <div className="provider-toolbar">
      <label className="provider-search"><span>חיפוש ספק</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="שם, שירות או תחום" /></label>
      <ModernSelect label="אזור שירות" value={region} onChange={setRegion} options={regions.map((option) => ({ value: option, label: option }))} />
      <div className="provider-categories" role="group" aria-label="סינון ספקים לפי תחום">
        {categories.map((entry) => <button key={entry.id} type="button" aria-pressed={category === entry.id} onClick={() => setCategory(entry.id)}>{entry.label}</button>)}
      </div>
    </div>
    <p className="provider-results-count" aria-live="polite">{filtered.length === 1 ? "ספק אחד מתאים" : `${filtered.length} ספקים מתאימים`}</p>
    {filtered.length ? <div className="discovery-grid">{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div> : <div className="provider-empty"><h3>לא מצאנו התאמה מדויקת</h3><p>אפשר לנקות את החיפוש או לבחור תחום אחר.</p></div>}
  </div>;
}
