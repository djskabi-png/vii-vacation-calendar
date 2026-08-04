/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { SearchBox } from "../components/search-box";
import { eventPlaces } from "../data/site-data";
import { PinIcon } from "../site-header";

export default function EventsPage() {
  return <PageShell variant="events"><main id="main-content"><section className="events-hero"><div className="shell"><span className="eyebrow">אירוע שמרגיש בדיוק שלכם</span><h1>מוצאים מקום לחגוג בו</h1><p>מחפשים לפי אזור, תאריך וכמות משתתפים, ומשווים בין המקומות שמתאימים לאירוע.</p><SearchBox mode="events" /></div></section><section className="section shell"><div className="section-head"><div><span className="eyebrow">אזורים מבוקשים</span><h2>איפה חוגגים?</h2></div></div><div className="event-region-grid">{["מרכז","השרון","צפון","תל אביב","ראשון לציון","באר שבע"].map((area) => <Link key={area} href={`/events/search/?location=${encodeURIComponent(area)}`}><PinIcon /><strong>{area}</strong><span>למקומות באזור</span></Link>)}</div></section><section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">מקומות שכדאי להכיר</span><h2>מומלצים לאירוע הבא</h2></div><Link href="/events/search/">לכל המקומות</Link></div><div className="event-card-grid">{eventPlaces.slice(0,4).map((place,index) => <article className="event-card" key={place.name}><Link href={`/events/place/?id=${index}`}><img src={place.image} alt={place.name} /><span className="event-card__body"><small>{place.type}</small><h3>{place.name}</h3><p><PinIcon />{place.location}</p><span className="button secondary">לפרטים</span></span></Link></article>)}</div></div></section><section className="section shell event-planning"><div><span className="eyebrow">בחירה חכמה יותר</span><h2>שלושה דברים שסוגרים לפני שבוחרים מקום</h2></div><ol><li><b>01</b><span><strong>הכמות</strong>מספר משתתפים ריאלי, כולל טווח ביטחון.</span></li><li><b>02</b><span><strong>הסגנון</strong>מסיבה, אירוע משפחתי או מפגש עסקי.</span></li><li><b>03</b><span><strong>הצרכים</strong>מוזיקה, אוכל, חניה ונגישות.</span></li></ol></section></main></PageShell>;
}
