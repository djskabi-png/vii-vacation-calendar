"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { CalendarDemo } from "../calendar-demo";
import { SiteHeader } from "../site-header";

const GALLERY = [
  "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
  "https://www.vii.co.il/gallery/3461b0895b7c07a.jpeg",
  "https://www.vii.co.il/gallery/426032b112228ee.jpeg",
  "https://www.vii.co.il/gallery/986032b1122a373.jpeg",
  "https://www.vii.co.il/gallery/261b0895b6faa4.jpeg",
];

const HIGHLIGHTS = ["4 סוויטות אירוח", "בריכת שחייה", "ג׳קוזי ספא מחומם", "שולחן פינג פונג", "פינת ברביקיו"];

const UNITS = [
  { name: "יחידת סטודיו שני", guests: "עד 4 אורחים", size: "40 מ״ר", price: "₪900" },
  { name: "יחידת סטודיו העמק", guests: "עד 2 אורחים", size: "20 מ״ר", price: "₪800" },
  { name: "סוויטה משפחתית וואנדרפול", guests: "עד 5 אורחים", size: "65 מ״ר", price: "₪900" },
  { name: "יחידת עכו", guests: "עד 3 אורחים", size: "20 מ״ר", price: "₪800" },
];

export default function BusinessDemoPage() {
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [dateSummary, setDateSummary] = useState("04/08 עד 05/08");
  const [selectionComplete, setSelectionComplete] = useState(false);

  return (
    <div className="live-page business-live-page" dir="rtl">
      <a className="skip-link" href="#business-content">דילוג לתוכן</a>
      <SiteHeader compact homeHref="../" />

      <div className="business-top-search" aria-label="חיפוש באתר">
        <span>⌖ <b>מיקום או מתחם</b></span>
        <button type="button" onClick={() => setCalendarOpen(true)}>▣ <b>{dateSummary}</b></button>
        <span>♙ <b>כמות נופשים</b></span>
        <button type="button" className="small-search-button" aria-label="חיפוש">⌕</button>
      </div>

      <main id="business-content" className="business-main">
        <nav className="breadcrumbs" aria-label="פירורי לחם">
          <a href="../">ראשי</a><span>›</span><a href="https://www.vii.co.il/s/Center/12519" target="_blank" rel="noreferrer">מתחמי נופש במרכז</a><span>›</span><span>קסם הרימון</span>
        </nav>

        <section className="business-hero" aria-labelledby="business-title">
          <aside className="business-summary-card">
            <span className="business-type">מתחם נופש בעזריקם</span>
            <h1 id="business-title">קסם הרימון</h1>
            <p>עזריקם, 4 סוויטות</p>
            <div className="business-contact-row"><button type="button">הצג מספר</button><button type="button" aria-label="יצירת קשר">☎</button></div>
            <div className="business-meta-list">
              <span>▣ <b>58 תמונות</b></span>
              <span>☷ תיאור מקום האירוח</span>
              <button type="button" onClick={() => setCalendarOpen(true)}>▣ <b>הזמינו מקום, {dateSummary}</b></button>
              <span>ⓘ מאפייני המתחם</span>
              <span><b>9.8</b> מעולה, 52 חוות דעת</span>
              <span>♧ מדיניות ותנאי תשלום וביטול</span>
            </div>
          </aside>

          <div className="business-gallery" aria-label="תמונות קסם הרימון">
            <figure className="gallery-main"><img src={GALLERY[0]} alt="קסם הרימון, מתחם הבריכה" /></figure>
            {GALLERY.slice(1).map((image, index) => (
              <figure key={image}><img src={image} alt={`קסם הרימון, תמונה ${index + 2}`} />{index === 3 && <button type="button">כל 58 התמונות</button>}</figure>
            ))}
          </div>
        </section>

        <div className="business-quick-actions" aria-label="פעולות בדף העסק">
          <button type="button"><span>♡</span>אהבתי</button>
          <button type="button"><span>⌯</span>שיתוף</button>
          <button type="button"><span>⌖</span>מפה</button>
        </div>

        <section className="business-description" aria-labelledby="description-title">
          <div>
            <span className="section-kicker">מכירים את המקום</span>
            <h2 id="description-title">תיאור מקום האירוח</h2>
            <p>קסם הרימון במושב עזריקם שבמישור החוף כולל ארבע סוויטות מפנקות. במתחם חצר משותפת גדולה, בריכת שחייה, ג׳קוזי ספא, שולחן פינג פונג, מדשאות ופינת מנגל.</p>
            <div className="highlight-list">
              {HIGHLIGHTS.map((item) => <span key={item}><i>✓</i>{item}</span>)}
            </div>
          </div>
          <div className="map-preview" aria-label="מיקום העסק">
            <span>⌖</span><strong>עזריקם</strong><small>מישור החוף והשפלה</small>
          </div>
        </section>

        <section className="online-booking" aria-labelledby="booking-title">
          <div className="booking-section-heading">
            <div><span className="section-kicker">זמינות ומחירים</span><h2 id="booking-title">בצעו הזמנה אונליין בקלות</h2></div>
            <span className="demo-label">המחשה אינטראקטיבית</span>
          </div>

          <button type="button" className="business-date-strip" onClick={() => setCalendarOpen(true)} aria-label="פתיחת יומן זמינות">
            <span><small>תאריך הגעה, לחצו לעריכה</small><strong>{dateSummary.split(" עד ")[0]}</strong><em>צ׳ק אין החל מ־15:00</em></span>
            <i aria-hidden="true">←</i>
            <span><small>תאריך עזיבה, לחצו לעריכה</small><strong>{dateSummary.split(" עד ")[1] ?? "בחירה"}</strong><em>צ׳ק אאוט עד 11:00</em></span>
            <b>▣</b>
          </button>

          <div className="booking-rules-summary">
            <span><b>4</b> יחידות במקום</span>
            <span><b>תפוס</b> לא ניתן לבחור</span>
            <span><b>מינ׳</b> לפי יום ההגעה</span>
            <button type="button" onClick={() => setCalendarOpen(true)}>שינוי תאריכים</button>
          </div>

          <div className="unit-grid">
            {UNITS.map((unit, index) => (
              <article className="unit-card" key={unit.name}>
                <div className="unit-image"><img src={GALLERY[(index + 1) % GALLERY.length]} alt={unit.name} /><span>יחידה אחת</span></div>
                <div className="unit-content">
                  <h3>{unit.name}</h3>
                  <div><span>▱ חדר שינה אחד</span><span>♙ {unit.guests}</span><span>□ {unit.size}</span></div>
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

          {selectionComplete && (
            <div className="unit-selection-feedback" role="status">
              <strong>היחידה נוספה לבחירה</strong>
              <span>במערכת המחוברת ממשיכים מכאן לסיכום האורחים, המחיר והתשלום.</span>
            </div>
          )}
        </section>
      </main>

      <footer className="vii-footer">
        <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
        <span>המחשה מותאמת לתבנית דף העסק הקיים</span>
        <a href="https://www.vii.co.il/villa_esem_harimon" target="_blank" rel="noreferrer">מעבר לדף העסק הפעיל</a>
      </footer>

      <CalendarDemo
        mode="business"
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onConfirm={(result) => { setDateSummary(result.summary); setSelectionComplete(false); }}
      />
    </div>
  );
}
