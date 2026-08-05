/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { PropertyCard } from "./components/property-card";
import { SearchBox } from "./components/search-box";
import { destinations, properties } from "./data/site-data";

export default function HomePage() {
  return (
    <PageShell>
      <main id="main-content">
        <section className="home-hero">
          <div className="shell home-hero__content">
            <span className="eyebrow">נופש, אירועים, ספא וחוויות</span>
            <h1>כל החופשה, במקום אחד</h1>
            <p>מוצאים מקום לישון, מקום לחגוג, זמן להתפנק וכל מה שכיף לעשות מסביב.</p>
            <SearchBox showWorlds />
            <div className="quick-links" aria-label="חיפושים מהירים"><span>חיפושים מהירים:</span><Link href="/search/?type=וילה">וילות</Link><Link href="/search/?feature=בריכה">עם בריכה</Link><Link href="/search/?audience=משפחות">למשפחות</Link><Link href="/search/?location=צפון">בצפון</Link></div>
          </div>
          <div className="hero-orb hero-orb--one" /><div className="hero-orb hero-orb--two" />
        </section>

        <section className="section shell" aria-labelledby="destination-title">
          <div className="section-head"><div><span className="eyebrow">בחרו כיוון</span><h2 id="destination-title">יעדים שכיף לברוח אליהם</h2></div><Link href="/destinations/">לכל היעדים</Link></div>
          <div className="destination-grid">{destinations.map((destination, index) => <Link key={destination.name} className={`destination-tile destination-tile--${index + 1}`} href={`/search/?location=${encodeURIComponent(destination.name)}`}><img src={destination.image} alt={destination.name} /><span><strong>{destination.name}</strong><small>{destination.subtitle}</small></span></Link>)}</div>
        </section>

        <section className="section section-tint" aria-labelledby="recommended-title">
          <div className="shell"><div className="section-head"><div><span className="eyebrow">שווה להכיר</span><h2 id="recommended-title">מקומות מומלצים לחופשה</h2></div><Link href="/search/">לכל המקומות</Link></div><div className="card-grid">{properties.slice(0, 3).map((property) => <PropertyCard key={property.slug} property={property} />)}</div></div>
        </section>

        <section className="section shell why-section" aria-labelledby="why-title">
          <div><span className="eyebrow">פשוט לבחור נכון</span><h2 id="why-title">כל המידע, בלי ללכת לאיבוד</h2><p>החיפוש, הזמינות, פרטי המקום והמדיניות נמצאים במסלול אחד ברור, בכל מסך ובכל מכשיר.</p><Link className="button primary" href="/search/">מתחילים לחפש</Link></div>
          <div className="benefit-grid"><article><b>01</b><h3>חיפוש מדויק</h3><p>מסננים לפי אזור, תאריך, הרכב ומאפיינים.</p></article><article><b>02</b><h3>תמונה מלאה</h3><p>רואים מה כלול, למי המקום מתאים ומה זמין.</p></article><article><b>03</b><h3>בחירה רגועה</h3><p>שומרים מקומות ומשווים בקצב שלכם.</p></article></div>
        </section>

        <section className="section shell event-promo"><div><span className="eyebrow">מתכננים אירוע?</span><h2>יש לנו עולם שלם גם לזה</h2><p>לופטים, מתחמים ומקומות לאירועים, עם חיפוש שמותאם לכמות המשתתפים ולסוג האירוע.</p><Link className="button light" href="/events/">לעולם האירועים</Link></div><img src="https://www.vii.co.il/gallery/thumb/600/5962a5b1c42c285.jpeg" alt="סטאר לופט" /></section>
      </main>
    </PageShell>
  );
}
