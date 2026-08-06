"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo } from "react";
import { DiscoveryCard } from "../../components/discovery-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { PageShell } from "../../components/page-shell";
import { getSpaDetails, type SpaDetails, type SpaPackage } from "../../data/spa-details";
import { getProviderDetails, type ProviderDetails, type ProviderService } from "../../data/provider-details";
import { getHourlyDetails, type HourlyDetails } from "../../data/hourly-details";
import { getActivityDetails, type ActivityDetails } from "../../data/activity-details";
import { discoveryItems, worlds, type WorldId } from "../../data/world-data";
import { PinIcon } from "../../site-header";
import { DiscoveryMap } from "../../components/listing-map";

function SpaPackageCard({ itemId, pack }: { itemId: string; pack: SpaPackage }) {
  const requestHref = `/contact?world=spa&place=${encodeURIComponent(itemId)}&package=${encodeURIComponent(pack.id)}`;
  return <article className="spa-package-card">
    <header><span>{pack.audience}</span>{pack.duration && <small>{pack.duration}</small>}</header>
    <h3>{pack.title}</h3>
    <ul>{pack.includes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
    <footer><strong>{pack.price}</strong><Link className="button primary" href={requestHref}>בדיקת זמינות</Link></footer>
  </article>;
}

function SpaContent({ itemId, details }: { itemId: string; details: SpaDetails }) {
  return <>
    <nav className="shell spa-detail-nav" aria-label="ניווט בדף הספא">
      <a href="#spa-about">על המקום</a>
      {details.packages?.length ? <a href="#spa-packages">חבילות</a> : null}
      {details.treatments?.length ? <a href="#spa-treatments">טיפולים</a> : null}
      <a href="#spa-facilities">מתקנים</a>
      {details.hours?.length ? <a href="#spa-info">שעות ופרטים</a> : null}
      <a href="#location">מפה</a>
    </nav>
    <section className="section shell spa-about" id="spa-about">
      <div><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>על המקום</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <aside>
        {details.address && <div><small>כתובת</small><strong>{details.address}</strong></div>}
        {details.phone && <div><small>טלפון</small><strong dir="ltr">{details.phone}</strong></div>}
        {details.suitableFor?.length && <div><small>מתאים עבור</small><strong>{details.suitableFor.join(" · ")}</strong></div>}
      </aside>
    </section>
    {details.packages?.length ? <section className="section section-tint" id="spa-packages"><div className="shell"><div className="section-head"><div><span className="eyebrow">בוחרים לפי החוויה</span><h2>{details.packagesAreRequests ? "מסלולי בקשה" : "חבילות הספא"}</h2><p>{details.packagesAreRequests ? "האפשרויות האלו נשלחות לבדיקה מול המקום. החבילה, המחיר והזמינות מאושרים לפני תשלום." : "רואים מראש מה כלול, למי החבילה מתאימה וכמה זמן כדאי להקדיש לביקור."}</p></div></div><div className="spa-packages-grid">{details.packages.map((pack) => <SpaPackageCard key={pack.id} itemId={itemId} pack={pack} />)}</div><p className="spa-price-note">המחירים המוצגים הם מחירי התחלה או מחיר בבדיקה. הזמינות והמחיר הסופי נקבעים לפי התאריך, ההרכב והאפשרויות שנבחרו.</p></div></section> : null}
    <section className="section shell spa-details-grid">
      {details.treatments?.length ? <div id="spa-treatments" className="spa-detail-panel"><span className="eyebrow">לבחירה במקום</span><h2>טיפולים</h2><div className="spa-treatment-list">{details.treatments.map((treatment) => <article key={treatment.name}><strong>{treatment.name}</strong>{treatment.durations?.length ? <span>{treatment.durations.join(" · ")}</span> : null}{treatment.priceNote ? <small>{treatment.priceNote}</small> : null}</article>)}</div></div> : null}
      <div id="spa-facilities" className="spa-detail-panel"><span className="eyebrow">בתוך המתחם</span><h2>מתקנים ושירותים</h2><ul className="spa-facility-list">{details.facilities.map((facility) => <li key={facility}>{facility}</li>)}</ul></div>
    </section>
    {(details.hours?.length || details.arrivalNotes?.length) ? <section className="section section-soft" id="spa-info"><div className="shell spa-visit-info"><div><span className="eyebrow">מתכננים את הביקור</span><h2>שעות ופרטים שימושיים</h2>{details.hours?.map((entry) => <p key={entry}>{entry}</p>)}</div>{details.arrivalNotes?.length ? <ul>{details.arrivalNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}</div></section> : null}
    {details.faq?.length ? <section className="section shell spa-faq"><div className="section-head"><div><span className="eyebrow">שאלות נפוצות</span><h2>כל מה שרציתם לדעת</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></section> : null}
  </>;
}

function ProviderServiceCard({ itemId, service }: { itemId: string; service: ProviderService }) {
  const requestHref = `/contact?world=providers&place=${encodeURIComponent(itemId)}&service=${encodeURIComponent(service.id)}`;
  return <article className="provider-service-card">
    <span>{service.suitableFor}</span>
    <h3>{service.title}</h3>
    <p>{service.description}</p>
    <ul>{service.includes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
    <Link className="button primary" href={requestHref}>בקשת הצעה</Link>
  </article>;
}

function ProviderContent({ itemId, details }: { itemId: string; details: ProviderDetails }) {
  return <>
    <nav className="shell provider-detail-nav" aria-label="ניווט בדף הספק">
      <a href="#provider-about">על הספק</a>
      <a href="#provider-services">שירותים</a>
      <a href="#provider-process">איך מזמינים</a>
      <a href="#provider-info">חשוב לדעת</a>
      <a href="#provider-faq">שאלות נפוצות</a>
    </nav>
    <section className="section shell provider-about" id="provider-about">
      <div><span className="eyebrow">פרופיל שירות מלא</span><h2>מה אפשר להזמין</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <aside>
        <span>תחום</span><strong>{details.category}</strong>
        <span>מתאים עבור</span><strong>{details.occasions.slice(0, 3).join(" · ")}</strong>
        {details.phone ? <><span>שיחה ישירה</span><a className="provider-phone" dir="ltr" href={`tel:${details.phone.replace(/[^\d+]/g, "")}`}>{details.phone}</a></> : <><span>יצירת קשר</span><strong>בקשת הצעה דרך האתר</strong></>}
      </aside>
    </section>
    <section className="section section-tint" id="provider-services"><div className="shell"><div className="section-head"><div><span className="eyebrow">בוחרים את השירות הנכון</span><h2>שירותים שאפשר לבקש</h2><p>כל בקשה עוברת עם התאריך, המקום ומספר המשתתפים כדי לקבל הצעה מדויקת.</p></div></div><div className="provider-services-grid">{details.services.map((service) => <ProviderServiceCard key={service.id} itemId={itemId} service={service} />)}</div></div></section>
    <section className="section shell provider-occasions"><div><span className="eyebrow">מתאים לחגיגה שלכם</span><h2>סוגי אירועים</h2></div><div>{details.occasions.map((occasion) => <span key={occasion}>{occasion}</span>)}</div></section>
    <section className="section section-soft" id="provider-process"><div className="shell"><div className="section-head"><div><span className="eyebrow">פשוט, ברור וללא ניחושים</span><h2>איך מזמינים</h2></div></div><ol className="provider-process">{details.process.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div></section>
    <section className="section shell provider-practical" id="provider-info"><div><span className="eyebrow">לפני שסוגרים</span><h2>חשוב לדעת</h2></div><ul>{details.practicalNotes.map((note) => <li key={note}>{note}</li>)}</ul></section>
    <section className="section shell provider-faq" id="provider-faq"><div className="section-head"><div><span className="eyebrow">שאלות נפוצות</span><h2>תשובות לפני ההזמנה</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></section>
    <section className="section provider-final-cta"><div className="shell"><div><span className="eyebrow">מוכנים לבדוק התאמה?</span><h2>שולחים בקשה אחת ומקבלים תשובה מסודרת</h2><p>התאריך, המקום, מספר המשתתפים והשירות המבוקש עוברים יחד לצוות.</p></div><div><Link className="button primary" href={`/contact?world=providers&place=${encodeURIComponent(itemId)}`}>בקשת הצעה</Link>{details.phone ? <a className="button secondary" href={`tel:${details.phone.replace(/[^\d+]/g, "")}`}>חיוג לספק</a> : null}</div></div></section>
  </>;
}

function HourlyContent({ itemId, details }: { itemId: string; details: HourlyDetails }) {
  return <>
    <nav className="shell depth-detail-nav" aria-label="ניווט בדף המקום"><a href="#hourly-about">על המקום</a><a href="#hourly-options">אפשרויות שהייה</a><a href="#hourly-amenities">מה במקום</a><a href="#hourly-info">לפני שמגיעים</a><a href="#hourly-faq">שאלות נפוצות</a><a href="#location">מפה</a></nav>
    <section className="section shell depth-about" id="hourly-about"><div><span className="eyebrow">כל המידע במקום אחד</span><h2>על המקום</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><aside><small>איך מזמינים</small><strong>שולחים שעה ומשך רצוי</strong><small>מתי ההזמנה סופית</small><strong>רק לאחר אישור זמינות ומחיר</strong></aside></section>
    <section className="section section-tint" id="hourly-options"><div className="shell"><div className="section-head"><div><span className="eyebrow">מתאימים את הביקור</span><h2>אפשרויות שהייה</h2></div></div><div className="depth-card-grid">{details.stayOptions.map((option) => <article key={option.title}><h3>{option.title}</h3><p>{option.description}</p><Link className="button primary" href={`/contact?world=hourly&place=${encodeURIComponent(itemId)}`}>בדיקת זמינות</Link></article>)}</div></div></section>
    <section className="section shell depth-columns"><div id="hourly-amenities"><span className="eyebrow">מה ידוע על המקום</span><h2>מתקנים ומאפיינים</h2><ul>{details.amenities.map((entry) => <li key={entry}>{entry}</li>)}</ul></div><div id="hourly-info"><span className="eyebrow">לפני שמגיעים</span><h2>פרטים שימושיים</h2><ul>{details.arrivalNotes.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></section>
    <section className="section shell depth-faq" id="hourly-faq"><div className="section-head"><div><span className="eyebrow">תשובות ברורות</span><h2>שאלות נפוצות</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><span className="eyebrow">מוכנים לבדוק?</span><h2>שולחים שעה רצויה ומקבלים תשובה מדויקת</h2><p>הבקשה כוללת את המקום, משך השהייה וכל בקשה מיוחדת.</p></div><Link className="button primary" href={`/contact?world=hourly&place=${encodeURIComponent(itemId)}`}>בדיקת זמינות</Link></div></section>
  </>;
}

function ActivityContent({ itemId, details }: { itemId: string; details: ActivityDetails }) {
  return <>
    <nav className="shell depth-detail-nav" aria-label="ניווט בדף הפעילות"><a href="#activity-about">על החוויה</a><a href="#activity-highlights">מה מחכה בדרך</a><a href="#activity-plan">תכנון מלא</a><a href="#activity-preparation">מה להכין</a><a href="#activity-faq">שאלות נפוצות</a></nav>
    <section className="section shell depth-about" id="activity-about"><div><span className="eyebrow">יוצאים עם תוכנית ברורה</span><h2>על החוויה</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><aside>{details.facts.map((fact) => <div key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</aside></section>
    <section className="section section-tint" id="activity-highlights"><div className="shell"><div className="section-head"><div><span className="eyebrow">למה כדאי</span><h2>מה מחכה בדרך</h2></div></div><div className="depth-card-grid">{details.highlights.map((entry) => <article key={entry}><h3>{entry}</h3></article>)}</div></div></section>
    <section className="section shell depth-columns"><div id="activity-plan"><span className="eyebrow">שלב אחר שלב</span><h2>{details.kind === "matching" ? "כך מתאימים את החוויה" : "תוכנית מוצעת"}</h2><ol>{details.plan.map((entry, index) => <li key={entry}><span>{index + 1}</span><p>{entry}</p></li>)}</ol></div><div id="activity-preparation"><span className="eyebrow">יוצאים מוכנים</span><h2>מה חשוב להכין</h2><ul>{details.preparation.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></section>
    <section className="section shell depth-faq" id="activity-faq"><div className="section-head"><div><span className="eyebrow">לפני שיוצאים</span><h2>שאלות נפוצות</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><span className="eyebrow">משלבים את זה בחופשה</span><h2>{details.kind === "matching" ? "נמצא חוויה שמתאימה בדיוק להרכב שלכם" : "שומרים את התוכנית וממשיכים לבחור מקום אירוח"}</h2><p>{details.kind === "matching" ? "הספק והזמינות נבדקים לפני שמוצגת הצעה." : "אפשר לחזור לחיפוש ולבחור מקום באזור שמתאים למסלול."}</p></div><Link className="button primary" href={details.kind === "matching" ? `/contact?world=activities&place=${encodeURIComponent(itemId)}` : "/"}>{details.kind === "matching" ? "בקשת התאמה" : "לחיפוש מקום אירוח"}</Link></div></section>
  </>;
}

export default function DiscoveryPlacePage({ initialId }: { initialId: string }) {
  const item = useMemo(() => discoveryItems.find((entry) => entry.id === initialId) || discoveryItems[0], [initialId]);
  const world = worlds.find((entry) => entry.id === item.world) || worlds[2];
  const related = discoveryItems.filter((entry) => entry.world === item.world && entry.id !== item.id).slice(0, 3);
  const spaDetails = item.world === "spa" ? getSpaDetails(item.id) : undefined;
  const providerDetails = item.world === "providers" ? getProviderDetails(item.id) : undefined;
  const hourlyDetails = item.world === "hourly" ? getHourlyDetails(item) : undefined;
  const activityDetails = item.world === "activities" ? getActivityDetails(item) : undefined;

  return <PageShell variant={item.world as WorldId}>
    <main id="main-content" className={`discovery-detail discovery-detail--${item.world}`}>
      <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><Link href={world.href}>{world.label}</Link><span>/</span><span>{item.name}</span></div>
      <section className="shell discovery-detail__hero">
        <div className="discovery-detail__copy"><span className="eyebrow">{world.label}</span><h1>{item.name}</h1><p className="discovery-detail__location"><PinIcon />{item.location}, {item.area}</p><p>{item.description}</p><div className="discovery-card__chips">{item.features.map((feature) => <span key={feature}>{feature}</span>)}</div><div className="discovery-detail__actions">{spaDetails ? <a className="button primary" href={spaDetails.packages?.length ? "#spa-packages" : "#spa-about"}>{spaDetails.packages?.length ? "לבחירת חבילה" : "לכל פרטי המקום"}</a> : providerDetails ? <><a className="button primary" href="#provider-services">לבחירת שירות</a>{providerDetails.phone ? <a className="button secondary" href={`tel:${providerDetails.phone.replace(/[^\d+]/g, "")}`}>חיוג לספק</a> : null}</> : hourlyDetails ? <a className="button primary" href="#hourly-options">לכל פרטי השהייה</a> : activityDetails ? <a className="button primary" href="#activity-plan">לתכנון המלא</a> : <Link className="button primary" href={world.href}>לכל האפשרויות</Link>}<Link className="button secondary" href={world.href}>חזרה לרשימה</Link></div></div>
        <div className={`discovery-detail__media discovery-card__placeholder--${item.world}`}>{item.image ? <><img src={item.image} alt={item.imageLabel ? `תמונת אווירה לתחום ${item.features[0]}` : item.name} />{item.imageLabel && <span className="image-context-label image-context-label--detail">{item.imageLabel}</span>}</> : <span><b>{item.name.slice(0, 1)}</b><small>{item.demo ? "פרופיל הדגמה" : "רעיון מערכת"}</small></span>}</div>
      </section>
      {spaDetails ? <SpaContent itemId={item.id} details={spaDetails} /> : null}
      {providerDetails ? <ProviderContent itemId={item.id} details={providerDetails} /> : null}
      {hourlyDetails ? <HourlyContent itemId={item.id} details={hourlyDetails} /> : null}
      {activityDetails ? <ActivityContent itemId={item.id} details={activityDetails} /> : null}
      {(spaDetails || hourlyDetails) ? <section className={`section shell discovery-location discovery-location--${item.world}`} id="location"><div className="discovery-location__intro"><span className="eyebrow">מכירים את האזור לפני שמגיעים</span><h2>המקום על המפה</h2><p>{item.world === "spa" ? "בודקים את האזור, המרחקים והדרך הנוחה להגיע לחוויית הספא." : "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור."}</p></div><DiscoveryMap items={[item]} tone={item.world === "spa" ? "spa" : "hourly"} single /></section> : null}
      {(item.world === "spa" || item.world === "hourly") && <div className="shell discovery-detail__accessibility"><ListingAccessibility slug={item.id} /></div>}
      <section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">באותו עולם</span><h2>עוד אפשרויות שכדאי לראות</h2></div></div><div className="discovery-grid">{related.map((entry) => <DiscoveryCard key={entry.id} item={entry} />)}</div></div></section>
    </main>
  </PageShell>;
}
