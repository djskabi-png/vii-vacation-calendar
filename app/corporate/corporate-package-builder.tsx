"use client";

import { type ReactNode, useState } from "react";
import { LeadIntakeForm } from "../components/lead-intake-form";

const packages = [
  { id: "office-wellness", title: "רגע לנשום", label: "רווחה במשרד", note: "חבילת רווחה שמגיעה עד העובדים", includes: ["עמדות עיסוי של מאסו", "טיפולי פנים או מתחם רוגע", "תיאום לפי כמות העובדים", "מנהל אירוע מטעמנו"] },
  { id: "team-day", title: "יוצאים מהשגרה", label: "יום גיבוש", note: "יום מלא שמחבר מקום, תוכן ואוכל", includes: ["בחירת אזור ומקום", "פעילות או מסלול", "ארוחה או ספק קולינרי", "לוח זמנים מלא"] },
  { id: "company-event", title: "מרימים אירוע", label: "אירוע חברה", note: "כל הספקים תחת תיאום אחד", includes: ["מקום לאירוע", "מוזיקה והגברה", "בר או קייטרינג", "צילום, עיצוב ותוכן"] },
  { id: "employee-gifts", title: "הבחירה שלהם", label: "מתנות לעובדים", note: "חבילת מתנות מרוכזת לארגון", includes: ["גיפט קארד בסכום לבחירה", "ברכה ארגונית", "חלוקה מרוכזת", "מעקב אחרי בקשות ומימושים"] },
] as const;

const additions = [
  { id: "transport", label: "הסעות", description: "איסוף והחזרה מתואמים", icon: "route" },
  { id: "catering", label: "קייטרינג", description: "תפריט שמתאים לאופי האירוע", icon: "food" },
  { id: "music", label: "תקליטן והגברה", description: "מוזיקה, סאונד וציוד", icon: "music" },
  { id: "photo", label: "צילום", description: "סטילס, וידאו ותיעוד", icon: "camera" },
  { id: "branding", label: "עיצוב ומיתוג", description: "שפה חזותית עד הפרט האחרון", icon: "spark" },
  { id: "masu", label: "טיפולי מאסו", description: "עיסוי וטיפולי פנים עד המקום", icon: "wellness" },
  { id: "gifts", label: "מתנות לעובדים", description: "מתנה אישית או ארגונית", icon: "gift" },
] as const;

function AdditionIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    route: <><path d="M5 19c3-7 6-9 14-14"/><path d="M5 19h4M15 5h4v4"/></>,
    food: <><path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c3 2 4 6 0 9"/></>,
    music: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="13" r="4"/></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/></>,
    wellness: <><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/><path d="M9 13h6"/></>,
    gift: <><path d="M4 10h16v11H4zM3 6h18v4H3zM12 6v15"/><path d="M12 6c-4 0-5-2-4-3s4 0 4 3Zm0 0c4 0 5-2 4-3s-4 0-4 3Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function CorporatePackageBuilder() {
  const [selectedId, setSelectedId] = useState(packages[1].id);
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const selected = packages.find((item) => item.id === selectedId) ?? packages[0];
  const selectedAdditionItems = additions.filter((item) => selectedAdditions.includes(item.id));
  const selectionLabel = `${selected.label}, ${selected.title}${selectedAdditionItems.length ? `, תוספות: ${selectedAdditionItems.map((item) => item.label).join(", ")}` : ""}`;

  function choosePackage(id: string) {
    setSelectedId(id as typeof selectedId);
    window.setTimeout(() => document.getElementById("corporate-contact")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function toggleAddition(id: string) {
    setSelectedAdditions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <>
    <section className="section corporate-packages" id="corporate-packages">
      <div className="shell">
        <div className="section-head"><div><span className="eyebrow">חבילות מלאות שקל להתחיל מהן</span><h2>בוחרים חבילה, ואנחנו מחברים את כל החלקים</h2><p>אין חיוב ואין הזנת אשראי. הבחירה נשמרת עם הבקשה ומומחה אירועי חברה חוזר כדי לדייק כמות, מועד, אזור ותקציב.</p></div></div>
        <div className="corporate-packages__grid">{packages.map((pack) => <article key={pack.id} className={selectedId === pack.id ? "selected" : ""}><span>{pack.label}</span><h3>{pack.title}</h3><p>{pack.note}</p><ul>{pack.includes.map((item) => <li key={item}>{item}</li>)}</ul><button className="button secondary" type="button" onClick={() => choosePackage(pack.id)}>{selectedId === pack.id ? "החבילה נבחרה" : "בחירת החבילה"}</button></article>)}</div>
      </div>
    </section>

    <section className="section section-tint corporate-builder" id="corporate-contact">
      <div className="shell">
        <ol className="corporate-builder__steps" aria-label="שלבי הרכבת החבילה">
          <li className="complete"><b>1</b><span><small>הושלם</small>בחרתם חבילה</span></li>
          <li className="active"><b>2</b><span><small>עכשיו</small>מוסיפים חוויות</span></li>
          <li><b>3</b><span><small>השלב הבא</small>שולחים למומחה</span></li>
        </ol>

        <div className="corporate-builder__intro">
          <span className="eyebrow">האירוע שלכם מתחיל לקבל צורה</span>
          <h2>מרכיבים חבילה שמתאימה בדיוק לצוות</h2>
          <p>בחרו רק את מה שמעניין אתכם. הסיכום מתעדכן מיד, והמומחה יקבל תמונה ברורה לפני השיחה הראשונה, ללא אשראי וללא התחייבות.</p>
        </div>

        <div className="corporate-builder__workspace">
          <div className="corporate-builder__config">
            <div className="corporate-selection-summary">
              <div><span>נקודת הפתיחה שלכם</span><strong>{selected.label}, {selected.title}</strong><small>{selected.note}</small></div>
              <button type="button" onClick={() => document.getElementById("corporate-packages")?.scrollIntoView({ behavior: "smooth" })}>שינוי חבילה</button>
            </div>

            <fieldset className="corporate-additions">
              <legend>מה ישדרג את האירוע?</legend>
              <p>אפשר לבחור כמה מרכיבים, להסיר ולשנות בכל רגע.</p>
              <div>{additions.map((addition) => {
                const isSelected = selectedAdditions.includes(addition.id);
                return <label key={addition.id} className={isSelected ? "selected" : ""}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleAddition(addition.id)} />
                  <span className="corporate-additions__icon"><AdditionIcon name={addition.icon} /></span>
                  <span className="corporate-additions__copy"><strong>{addition.label}</strong><small>{addition.description}</small></span>
                  <span className="corporate-additions__check" aria-hidden="true">✓</span>
                </label>;
              })}</div>
            </fieldset>

            <div className="corporate-live-summary" aria-live="polite">
              <div><span>החבילה שלכם</span><strong>{selected.label}, {selected.title}</strong></div>
              <div className="corporate-live-summary__count"><b>{selectedAdditionItems.length}</b><span>תוספות נבחרו</span></div>
              <div className="corporate-live-summary__items">
                {selectedAdditionItems.length ? selectedAdditionItems.map((item) => <span key={item.id}>{item.label}<button type="button" onClick={() => toggleAddition(item.id)} aria-label={`הסרת ${item.label}`}>×</button></span>) : <p>לא חייבים להוסיף דבר. המומחה יתחיל מהחבילה שבחרתם.</p>}
              </div>
            </div>
          </div>

          <LeadIntakeForm purpose="booking" formVariant="corporate" fixedWorld="corporate" selectedPackage={selectionLabel} submitLabel="שליחת החבילה למומחה אירועים" />
        </div>
      </div>
    </section>
  </>;
}
