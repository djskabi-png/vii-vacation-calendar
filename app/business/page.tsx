"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { CalendarDemo } from "../calendar-demo";
import { SiteHeader } from "../site-header";

type Scenario = "multi" | "single";

const MULTI_GALLERY = [
  "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
  "https://www.vii.co.il/gallery/3461b0895b7c07a.jpeg",
  "https://www.vii.co.il/gallery/426032b112228ee.jpeg",
  "https://www.vii.co.il/gallery/986032b1122a373.jpeg",
  "https://www.vii.co.il/gallery/261b0895b6faa4.jpeg",
];

const SINGLE_GALLERY = ["https://www.vii.co.il/gallery/396a5627536911d.jpg"];

const UNITS = [
  { name: "יחידת סטודיו שני", guests: "עד 4 אורחים", size: "40 מ״ר", price: "₪900" },
  { name: "יחידת סטודיו העמק", guests: "עד 2 אורחים", size: "20 מ״ר", price: "₪800" },
  { name: "סוויטה משפחתית וואנדרפול", guests: "עד 5 אורחים", size: "65 מ״ר", price: "₪900" },
  { name: "יחידת עכו", guests: "עד 3 אורחים", size: "20 מ״ר", price: "₪800" },
];

const SCENARIOS = {
  multi: {
    name: "קסם הרימון",
    type: "מתחם נופש בעזריקם",
    location: "עזריקם",
    area: "מישור החוף והשפלה",
    summary: "עזריקם, 4 סוויטות",
    gallery: MULTI_GALLERY,
    galleryCount: 58,
    liveHref: "https://www.vii.co.il/villa_esem_harimon",
    mapHref: "https://www.google.com/maps/search/?api=1&query=%D7%A7%D7%A1%D7%9D%20%D7%94%D7%A8%D7%99%D7%9E%D7%95%D7%9F%20%D7%A2%D7%96%D7%A8%D7%99%D7%A7%D7%9D",
    breadcrumb: "מתחמי נופש במרכז",
    description: "קסם הרימון במושב עזריקם כולל ארבע סוויטות וחצר משותפת. בתרחיש הזה בוחרים תאריכים, רואים כמה יחידות פנויות בכל יום וממשיכים לבחירת היחידה המתאימה.",
    highlights: ["4 סוויטות אירוח", "בחירת יחידה לאחר התאריכים", "כמות פנויה מוצגת ביומן", "כללי מינימום לילות", "בדיקת טווחים תפוסים"],
  },
  single: {
    name: "אקווה ריזורט, וילת החוף",
    type: "וילת נופש באילת",
    location: "אילת",
    area: "דרום הארץ",
    summary: "אילת, וילה עם 5 חדרי שינה",
    gallery: SINGLE_GALLERY,
    galleryCount: 1,
    liveHref: "https://www.vii.co.il/Aqua_Resort_-_Beachfront_Villa_Eilat",
    mapHref: "https://www.google.com/maps/search/?api=1&query=Aqua%20Resort%20Eilat",
    breadcrumb: "נופש באילת",
    description: "זהו תרחיש תפקוד של מקום אירוח יחיד. האורחים בוחרים את כל הווילה, ולכן הממשק אינו מציג כמות יחידות ואינו מבקש לבחור יחידה נוספת אחרי בחירת התאריכים.",
    highlights: ["מקום אירוח יחיד", "5 חדרי שינה", "בחירת כל המקום", "כללי מינימום לילות", "בדיקת תאריכים תפוסים"],
  },
} as const;

export default function BusinessDemoPage() {
  const [scenario, setScenario] = useState<Scenario>("multi");
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dateSummary, setDateSummary] = useState("04/08 עד 05/08");
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [favourite, setFavourite] = useState(false);
  const [status, setStatus] = useState("");

  const business = SCENARIOS[scenario];
  const isSingle = scenario === "single";
  const gallery = useMemo(() => business.gallery, [business.gallery]);

  useEffect(() => {
    const readScenario = () => {
      const value = new URLSearchParams(window.location.search).get("scenario");
      setScenario(value === "single" ? "single" : "multi");
    };
    readScenario();
    window.addEventListener("popstate", readScenario);
    return () => window.removeEventListener("popstate", readScenario);
  }, []);

  useEffect(() => {
    if (!galleryOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setGalleryOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [galleryOpen]);

  function changeScenario(next: Scenario) {
    setScenario(next);
    setSelectionComplete(false);
    setFavourite(false);
    setStatus("");
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", next);
    window.history.replaceState({}, "", url);
  }

  async function sharePage() {
    const shareData = { title: business.name, text: `המחשת הזמנה עבור ${business.name}`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setStatus("חלון השיתוף נפתח");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setStatus("הקישור הועתק");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setStatus("לא הצלחנו לפתוח שיתוף, אפשר להעתיק את הכתובת משורת הדפדפן");
    }
  }

  return (
    <div className="live-page business-live-page" dir="rtl">
      <a className="skip-link" href="#business-content">דילוג לתוכן</a>
      <SiteHeader compact homeHref="../" businessHref="./" />

      <div className="business-top-search" aria-label="חיפוש באתר">
        <span>⌖ <b>{business.location}</b></span>
        <button type="button" onClick={() => setCalendarOpen(true)}>▣ <b>{dateSummary}</b></button>
        <span>♟ <b>{isSingle ? "כל המקום" : "כמות נופשים"}</b></span>
        <a className="small-search-button" href="../" aria-label="חזרה לחיפוש הכללי">⌕</a>
      </div>

      <main id="business-content" className="business-main">
        <section className="scenario-switcher" aria-labelledby="scenario-title">
          <div>
            <span>שני מצבי הזמנה אמיתיים</span>
            <h2 id="scenario-title">בחרו תרחיש לבדיקה</h2>
          </div>
          <div role="group" aria-label="סוג מקום האירוח">
            <button type="button" className={scenario === "multi" ? "active" : ""} aria-pressed={scenario === "multi"} onClick={() => changeScenario("multi")}>מתחם עם כמה יחידות</button>
            <button type="button" className={scenario === "single" ? "active" : ""} aria-pressed={scenario === "single"} onClick={() => changeScenario("single")}>מקום אירוח יחיד</button>
          </div>
        </section>

        <nav className="breadcrumbs" aria-label="פירורי לחם">
          <a href="../">ראשי</a><span>‹</span><span>{business.breadcrumb}</span><span>‹</span><span>{business.name}</span>
        </nav>

        <section className={`business-hero${isSingle ? " single-business" : ""}`} aria-labelledby="business-title">
          <aside className="business-summary-card">
            <span className="business-type">{business.type}</span>
            <h1 id="business-title">{business.name}</h1>
            <p>{business.summary}</p>
            <div className="business-contact-row">
              <a href={business.liveHref} target="_blank" rel="noreferrer">פרטי קשר באתר הפעיל</a>
              <a href={business.liveHref} target="_blank" rel="noreferrer" aria-label="פתיחת פרטי הקשר באתר הפעיל">☎</a>
            </div>
            <div className="business-meta-list">
              <button type="button" onClick={() => setGalleryOpen(true)}>▣ <b>{isSingle ? "תמונה מאומתת" : `${business.galleryCount} תמונות`}</b></button>
              <span>● תיאור מקום האירוח</span>
              <button type="button" onClick={() => setCalendarOpen(true)}>▣ <b>בדיקת זמינות, {dateSummary}</b></button>
              <span>◆ מאפייני המקום</span>
              {!isSingle && <span><b>9.8</b> מעולה, 52 חוות דעת</span>}
              <span>▧ מדיניות ותנאי תשלום וביטול באתר הפעיל</span>
            </div>
          </aside>

          <div className="business-gallery" aria-label={`תמונות ${business.name}`}>
            <figure className="gallery-main">
              <button type="button" className="gallery-image-button" onClick={() => setGalleryOpen(true)} aria-label={`פתיחת תמונת ${business.name}`}>
                <img src={gallery[0]} alt={`${business.name}, מקום האירוח`} />
              </button>
            </figure>
            {!isSingle && gallery.slice(1).map((image, index) => (
              <figure key={image}>
                <button type="button" className="gallery-image-button" onClick={() => setGalleryOpen(true)} aria-label={`פתיחת תמונה ${index + 2} של ${business.name}`}>
                  <img src={image} alt={`${business.name}, תמונה ${index + 2}`} />
                </button>
                {index === 3 && <button type="button" className="all-photos-button" onClick={() => setGalleryOpen(true)}>כל {business.galleryCount} התמונות</button>}
              </figure>
            ))}
          </div>
        </section>

        <div className="business-quick-actions" aria-label="פעולות בדף העסק">
          <button type="button" aria-pressed={favourite} className={favourite ? "active" : ""} onClick={() => { setFavourite((value) => !value); setStatus(favourite ? "הוסר מהמועדפים" : "נוסף למועדפים"); }}><span>♡</span>{favourite ? "נשמר" : "אהבתי"}</button>
          <button type="button" onClick={sharePage}><span>↗</span>שיתוף</button>
          <a href={business.mapHref} target="_blank" rel="noreferrer"><span>⌖</span>מפה</a>
        </div>
        <p className="action-status" aria-live="polite">{status}</p>

        <section className="business-description" aria-labelledby="description-title">
          <div>
            <span className="section-kicker">מכירים את המקום</span>
            <h2 id="description-title">איך ההזמנה מתפקדת כאן</h2>
            <p>{business.description}</p>
            <div className="highlight-list">
              {business.highlights.map((item) => <span key={item}><i>✓</i>{item}</span>)}
            </div>
          </div>
          <a className="map-preview" href={business.mapHref} target="_blank" rel="noreferrer" aria-label={`פתיחת ${business.location} במפה`}>
            <span>⌖</span><strong>{business.location}</strong><small>{business.area}</small>
          </a>
        </section>

        <section className="online-booking" aria-labelledby="booking-title">
          <div className="booking-section-heading">
            <div><span className="section-kicker">זמינות ומחירים</span><h2 id="booking-title">{isSingle ? "בדקו זמינות לכל המקום" : "בצעו הזמנה אונליין בקלות"}</h2></div>
            <span className="demo-label">המחשת תפקוד</span>
          </div>

          <button type="button" className="business-date-strip" onClick={() => setCalendarOpen(true)} aria-label="פתיחת יומן זמינות">
            <span><small>תאריך הגעה, לחצו לעריכה</small><strong>{dateSummary.split(" עד ")[0]}</strong><em>צ׳ק אין החל מ־15:00</em></span>
            <i aria-hidden="true">←</i>
            <span><small>תאריך עזיבה, לחצו לעריכה</small><strong>{dateSummary.split(" עד ")[1] ?? "בחירה"}</strong><em>צ׳ק אאוט עד 11:00</em></span>
            <b>▣</b>
          </button>

          <div className="booking-rules-summary">
            <span><b>{isSingle ? "כל המקום" : "4"}</b> {isSingle ? "נבחר יחד" : "יחידות במתחם"}</span>
            <span><b>תפוס</b> לא ניתן לבחירה</span>
            <span><b>מינ׳</b> לפי יום ההגעה</span>
            <button type="button" onClick={() => setCalendarOpen(true)}>שינוי תאריכים</button>
          </div>

          {isSingle ? (
            <article className="single-place-booking">
              <img src={gallery[0]} alt={`${business.name}, וילה באילת`} />
              <div>
                <span>מקום אירוח יחיד</span>
                <h3>כל הווילה עומדת לבחירה</h3>
                <p>לא מציגים כמות יחידות ולא מוסיפים שלב בחירת יחידה. לאחר בחירת טווח פנוי ממשיכים ישירות לבדיקת המחיר וההזמנה.</p>
              </div>
              <button type="button" onClick={() => setCalendarOpen(true)}>בדיקת מחיר וזמינות</button>
            </article>
          ) : (
            <div className="unit-grid">
              {UNITS.map((unit, index) => (
                <article className="unit-card" key={unit.name}>
                  <div className="unit-image"><img src={gallery[(index + 1) % gallery.length]} alt={unit.name} /><span>יחידה אחת</span></div>
                  <div className="unit-content">
                    <h3>{unit.name}</h3>
                    <div><span>▱ חדר שינה אחד</span><span>♟ {unit.guests}</span><span>▣ {unit.size}</span></div>
                    <ul><li>מיטה זוגית</li><li>מיזוג</li><li>חדר רחצה פרטי</li></ul>
                  </div>
                  <div className="unit-price">
                    <span>זמין בטווח שנבחר</span>
                    <strong>{unit.price}</strong>
                    <small>להמחשת לילה אחד</small>
                    <button type="button" onClick={() => setSelectionComplete(true)}>בחירת יחידה</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {selectionComplete && !isSingle && (
            <div className="unit-selection-feedback" role="status">
              <strong>היחידה נוספה לבחירה</strong>
              <span>במערכת המחוברת ממשיכים מכאן לסיכום האורחים, המחיר והתשלום.</span>
            </div>
          )}
        </section>
      </main>

      <footer className="vii-footer">
        <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
        <span>המחשת תפקוד המותאמת לדף העסק</span>
        <a href={business.liveHref} target="_blank" rel="noreferrer">מעבר לדף העסק הפעיל</a>
      </footer>

      <CalendarDemo
        mode="business"
        businessKind={scenario}
        businessName={business.name}
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(result) => { setDateSummary(result.summary); setSelectionComplete(false); }}
      />

      {galleryOpen && (
        <div className="gallery-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setGalleryOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="gallery-title">
            <header><div><span>תמונות מקור מאומתות</span><h2 id="gallery-title">{business.name}</h2></div><button type="button" onClick={() => setGalleryOpen(false)} aria-label="סגירת גלריה">×</button></header>
            <div className={`gallery-modal-grid${isSingle ? " single" : ""}`}>
              {gallery.map((image, index) => <img key={image} src={image} alt={`${business.name}, תמונה ${index + 1}`} />)}
            </div>
            {isSingle && <p>בתרחיש זה מוצגת רק התמונה שאומתה ממקור העסק. לא נוספו תמונות המחשה שאינן שייכות למקום.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
