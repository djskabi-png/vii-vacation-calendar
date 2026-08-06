"use client";

import { useMemo, useState } from "react";
import { LeadIntakeForm } from "../components/lead-intake-form";

const packages = [
  { id: "office-wellness", title: "רגע לנשום", label: "רווחה במשרד", note: "חבילת רווחה שמגיעה עד העובדים", includes: ["עמדות עיסוי של מאסו", "טיפולי פנים או מתחם רוגע", "תיאום לפי כמות העובדים", "מנהל אירוע מטעמנו"] },
  { id: "team-day", title: "יוצאים מהשגרה", label: "יום גיבוש", note: "יום מלא שמחבר מקום, תוכן ואוכל", includes: ["בחירת אזור ומקום", "פעילות או מסלול", "ארוחה או ספק קולינרי", "לוח זמנים מלא"] },
  { id: "company-event", title: "מרימים אירוע", label: "אירוע חברה", note: "כל הספקים תחת תיאום אחד", includes: ["מקום לאירוע", "מוזיקה והגברה", "בר או קייטרינג", "צילום, עיצוב ותוכן"] },
  { id: "employee-gifts", title: "הבחירה שלהם", label: "מתנות לעובדים", note: "חבילת מתנות מרוכזת לארגון", includes: ["גיפט קארד בסכום לבחירה", "ברכה ארגונית", "חלוקה מרוכזת", "מעקב אחרי בקשות ומימושים"] },
] as const;

const additions = ["הסעות", "קייטרינג", "תקליטן והגברה", "צילום", "עיצוב ומיתוג", "טיפולי מאסו", "מתנות לעובדים"];

export function CorporatePackageBuilder() {
  const [selectedId, setSelectedId] = useState(packages[1].id);
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const selected = packages.find((item) => item.id === selectedId) ?? packages[0];
  const selectionLabel = useMemo(() => `${selected.label}, ${selected.title}${selectedAdditions.length ? `, תוספות: ${selectedAdditions.join(", ")}` : ""}`, [selected, selectedAdditions]);

  function choosePackage(id: string) {
    setSelectedId(id as typeof selectedId);
    window.setTimeout(() => document.getElementById("corporate-contact")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function toggleAddition(addition: string) {
    setSelectedAdditions((current) => current.includes(addition) ? current.filter((item) => item !== addition) : [...current, addition]);
  }

  return <>
    <section className="section corporate-packages" id="corporate-packages">
      <div className="shell">
        <div className="section-head"><div><span className="eyebrow">חבילות מלאות שקל להתחיל מהן</span><h2>בוחרים חבילה, ואנחנו מחברים את כל החלקים</h2><p>אין חיוב ואין הזנת אשראי. הבחירה נשמרת עם הבקשה ומומחה אירועי חברה חוזר כדי לדייק כמות, מועד, אזור ותקציב.</p></div></div>
        <div className="corporate-packages__grid">{packages.map((pack) => <article key={pack.id} className={selectedId === pack.id ? "selected" : ""}><span>{pack.label}</span><h3>{pack.title}</h3><p>{pack.note}</p><ul>{pack.includes.map((item) => <li key={item}>{item}</li>)}</ul><button className="button secondary" type="button" onClick={() => choosePackage(pack.id)}>{selectedId === pack.id ? "החבילה נבחרה" : "בחירת החבילה"}</button></article>)}</div>
      </div>
    </section>

    <section className="section section-tint" id="corporate-contact"><div className="shell corporate-contact"><div><span className="eyebrow">חבילה אחת, מומחה אחד</span><h2>מרכיבים את אירוע החברה</h2><p>התחילו מהחבילה שבחרתם והוסיפו את המרכיבים הרצויים. הבקשה תעבור למומחה אירועי חברה ורווחה, ללא אשראי וללא התחייבות.</p><div className="corporate-selection-summary"><span>החבילה שנבחרה</span><strong>{selected.label}, {selected.title}</strong></div><fieldset className="corporate-additions"><legend>מה תרצו להוסיף?</legend><div>{additions.map((addition) => <label key={addition}><input type="checkbox" checked={selectedAdditions.includes(addition)} onChange={() => toggleAddition(addition)} /><span>{addition}</span></label>)}</div></fieldset></div><LeadIntakeForm purpose="booking" fixedWorld="corporate" selectedPackage={selectionLabel} submitLabel="שליחת החבילה למומחה אירועים" /></div></section>
  </>;
}
