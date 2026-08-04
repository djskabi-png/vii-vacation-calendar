"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { CalendarDemo } from "./calendar-demo";
import { SiteHeader } from "./site-header";

const DESTINATIONS = ["כל הארץ", "צפון", "כנרת", "אילת", "מרכז", "ירושלים", "ים המלח"];

const FEATURED_DESTINATIONS = [
  {
    title: "נופש בכנרת",
    searchValue: "כנרת",
    subtitle: "הילת הנוף, כלנית",
    image: "https://www.vii.co.il/gallery/thumb/600/9686399e38f7b3.jpg",
  },
  {
    title: "נופש בגליל המערבי",
    searchValue: "צפון",
    subtitle: "בקתות משי, מעונה",
    image: "https://www.vii.co.il/gallery/thumb/600/5960b4da6615590.jpeg",
  },
  {
    title: "נופש בצפון",
    searchValue: "צפון",
    subtitle: "סוויטת נסיה בוטיק, נטועה",
    image: "https://www.vii.co.il/gallery/thumb/600/126936d3700478d.JPG",
  },
  {
    title: "נופש במרכז",
    searchValue: "מרכז",
    subtitle: "קסם הרימון, עזריקם",
    image: "https://www.vii.co.il/gallery/3461b0895b7c07a.jpeg",
  },
  {
    title: "נופש באילת",
    searchValue: "אילת",
    subtitle: "אקווה ריזורט, אילת",
    image: "https://www.vii.co.il/gallery/396a5627536911d.jpg",
  },
];

const RECOMMENDED = [
  {
    name: "קסם הרימון",
    place: "עזריקם, 4 סוויטות",
    image: "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
    score: "9.8",
    reviews: "52 חוות דעת",
    demoScenario: "multi",
    liveHref: "https://www.vii.co.il/villa_esem_harimon",
  },
  {
    name: "הילת הנוף",
    place: "כלנית, 4 בקתות עץ",
    image: "https://www.vii.co.il/gallery/thumb/600/9686399e38f7b3.jpg",
    score: "10",
    reviews: "180 חוות דעת",
    demoScenario: null,
    liveHref: "https://www.vii.co.il/",
  },
  {
    name: "אקווה ריזורט, וילת החוף",
    place: "אילת, וילה עם 5 חדרי שינה",
    image: "https://www.vii.co.il/gallery/396a5627536911d.jpg",
    score: "חדש",
    reviews: "ללא דירוג עדיין",
    demoScenario: "single",
    liveHref: "https://www.vii.co.il/Aqua_Resort_-_Beachfront_Villa_Eilat",
  },
];

export default function HomePage() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [destination, setDestination] = useState("כל הארץ");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [dateSummary, setDateSummary] = useState("תאריך מבוקש");
  const [searchReady, setSearchReady] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [actionStatus, setActionStatus] = useState("");
  const searchRef = useRef<HTMLElement>(null);
  const recommendationsRef = useRef<HTMLElement>(null);

  const guestSummary = `${adults + children} נופשים, ${rooms} ${rooms === 1 ? "חדר" : "חדרים"}`;

  function runSearch() {
    setDestinationOpen(false);
    setGuestOpen(false);
    if (dateSummary === "תאריך מבוקש") {
      setCalendarOpen(true);
      setSearchReady(false);
      return;
    }
    setSearchReady(true);
    window.setTimeout(() => recommendationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function chooseDestination(value: string) {
    setDestination(value);
    setSearchReady(false);
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleFavourite(name: string) {
    const isSaved = favourites.includes(name);
    setFavourites((current) => isSaved ? current.filter((item) => item !== name) : [...current, name]);
    setActionStatus(isSaved ? `${name} הוסר מהמועדפים` : `${name} נוסף למועדפים`);
  }

  return (
    <div className="live-page home-live-page" dir="rtl">
      <a className="skip-link" href="#main-content">דילוג לתוכן</a>
      <SiteHeader />

      <main id="main-content">
        <section ref={searchRef} className="home-search-section" aria-labelledby="home-title">
          <div className="home-title-block">
            <span>נופש שמתאים בדיוק לכם</span>
            <h1 id="home-title">מוצאים מקום, בוחרים תאריך ויוצאים לחופשה</h1>
          </div>

          <div className="real-search-bar" aria-label="חיפוש נופש">
            <div className="search-popover-wrap location-search-wrap">
              <button
                type="button"
                className="real-search-field"
                aria-expanded={destinationOpen}
                onClick={() => { setDestinationOpen((value) => !value); setGuestOpen(false); }}
              >
                <span className="field-icon" aria-hidden="true">⌖</span>
                <span><small>מיקום או מתחם</small><strong>{destination}</strong></span>
              </button>
              {destinationOpen && (
                <div className="compact-popover destination-popover" role="dialog" aria-label="בחירת יעד">
                  <strong>לאן תרצו לצאת?</strong>
                  <div>
                    {DESTINATIONS.map((item) => (
                      <button type="button" key={item} className={destination === item ? "selected" : ""} onClick={() => { setDestination(item); setDestinationOpen(false); setSearchReady(false); }}>{item}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="button" className="real-search-field date-trigger" onClick={() => { setCalendarOpen(true); setDestinationOpen(false); setGuestOpen(false); }}>
              <span className="field-icon" aria-hidden="true">▣</span>
              <span><small>תאריך מבוקש</small><strong>{dateSummary}</strong></span>
            </button>

            <div className="search-popover-wrap guest-search-wrap">
              <button type="button" className="real-search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setDestinationOpen(false); }}>
                <span className="field-icon" aria-hidden="true">♙</span>
                <span><small>כמות נופשים וחדרים</small><strong>{guestSummary}</strong></span>
              </button>
              {guestOpen && (
                <div className="compact-popover guest-popover" role="dialog" aria-label="בחירת אורחים">
                  <GuestCounter label="מבוגרים" value={adults} min={1} max={12} onChange={setAdults} />
                  <GuestCounter label="ילדים" value={children} min={0} max={8} onChange={setChildren} />
                  <GuestCounter label="חדרים" value={rooms} min={1} max={6} onChange={setRooms} />
                  <button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button>
                </div>
              )}
            </div>

            <button type="button" className="main-search-button" onClick={runSearch} aria-label="חיפוש">
              <span aria-hidden="true">⌕</span>
              <strong>חיפוש</strong>
            </button>
          </div>

          <div className={`search-result-hint${searchReady ? " visible" : ""}`} aria-live="polite">
            <strong>{searchReady ? "החיפוש מוכן" : "איך זה עובד"}</strong>
            <span>{searchReady ? `בגרסה המחוברת נעבור לתוצאות עבור ${destination}, ${dateSummary}, ${guestSummary}.` : "לחיצה על שדה התאריך פותחת את היומן החדש מעל דף הבית, בלי מגבלות של עסק מסוים."}</span>
          </div>
        </section>

        <section className="home-section destination-section" aria-labelledby="destinations-title">
          <div className="section-heading">
            <div>
              <span>מתחילים לבחור</span>
              <h2 id="destinations-title">יעדים מומלצים</h2>
            </div>
            <a href="https://www.vii.co.il/" target="_blank" rel="noreferrer">לכל היעדים</a>
          </div>
          <div className="destination-cards">
            {FEATURED_DESTINATIONS.map((item) => (
              <article className="destination-card" key={item.title}>
                <button type="button" onClick={() => chooseDestination(item.searchValue)} aria-label={`בחירת ${item.title} בחיפוש`}>
                  <img src={item.image} alt={item.subtitle} />
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section ref={recommendationsRef} className="home-section recommended-section" aria-labelledby="recommended-title">
          <div className="section-heading">
            <div>
              <span>נבחרו מתוך האתר</span>
              <h2 id="recommended-title">מקומות מומלצים</h2>
            </div>
            <span className="verified-source">תמונות ופרטים מהאתר הפעיל</span>
          </div>
          <div className="property-card-grid">
            {RECOMMENDED.map((item) => (
              <article className="property-card" key={item.name}>
                <div className="property-card-image"><img src={item.image} alt={item.name} /><button type="button" className={favourites.includes(item.name) ? "saved" : ""} aria-pressed={favourites.includes(item.name)} aria-label={`${favourites.includes(item.name) ? "הסרת" : "הוספת"} ${item.name} ${favourites.includes(item.name) ? "מהמועדפים" : "למועדפים"}`} onClick={() => toggleFavourite(item.name)}>{favourites.includes(item.name) ? "♥" : "♡"}</button></div>
                <div className="property-card-content">
                  <div><h3>{item.name}</h3><p>{item.place}</p></div>
                  <div className="rating-chip"><strong>{item.score}</strong><span>{item.reviews}</span></div>
                </div>
                {item.demoScenario ? (
                  <a className="card-action" href={`./business/?scenario=${item.demoScenario}`}>{item.demoScenario === "single" ? "להמחשת מקום אירוח יחיד" : "להמחשת מתחם עם יחידות"}</a>
                ) : (
                  <a className="card-action muted" href={item.liveHref} target="_blank" rel="noreferrer">לצפייה באתר הפעיל</a>
                )}
              </article>
            ))}
          </div>
          <p className="action-status" aria-live="polite">{actionStatus}</p>
        </section>
      </main>

      <footer className="vii-footer">
        <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
        <span>המחשה מותאמת למבנה דף הבית הקיים</span>
        <a href="https://www.vii.co.il/" target="_blank" rel="noreferrer">מעבר לאתר הפעיל</a>
      </footer>

      <CalendarDemo
        mode="home"
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(result) => { setDateSummary(result.summary); setSearchReady(false); }}
      />
    </div>
  );
}

function GuestCounter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="guest-counter">
      <strong>{label}</strong>
      <div>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`הפחתת ${label}`}>−</button>
        <span>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`הוספת ${label}`}>+</button>
      </div>
    </div>
  );
}
