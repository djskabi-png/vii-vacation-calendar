"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import { eventPlaces } from "../../data/site-data";
import { PinIcon } from "../../site-header";

export default function EventSearchPage() {
  const [type, setType] = useState("הכל");
  const filtered = type === "הכל" ? eventPlaces : eventPlaces.filter((p) => p.type.includes(type));
  return <PageShell variant="events"><main id="main-content" className="results-page"><div className="results-search shell"><SearchBox mode="events" compact /></div><section className="shell results-heading"><div><span className="eyebrow">תוצאות לאירוע</span><h1>מקומות לאירועים</h1><p>{filtered.length} מקומות מוצגים</p></div></section><div className="shell event-results-layout"><aside className="filter-panel static"><h2>סינון</h2><fieldset><legend>סוג מקום</legend>{["הכל","לופט","מתחם"].map((item) => <label key={item}><input type="radio" name="event-type" checked={type===item} onChange={() => setType(item)} /> {item}</label>)}</fieldset><fieldset><legend>מתאים ל</legend><label><input type="checkbox" /> מסיבה</label><label><input type="checkbox" /> אירוע משפחתי</label><label><input type="checkbox" /> אירוע עסקי</label></fieldset></aside><section className="event-list">{filtered.map((place,index) => <article key={place.name}><img src={place.image} alt={place.name} /><div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}</p><div className="feature-chips"><span>מידע על המקום</span><span>גלריה</span><span>יצירת קשר</span></div><Link className="button primary" href={`/events/place/?id=${index}`}>לפרטים על המקום</Link></div></article>)}</section></div></main></PageShell>;
}
