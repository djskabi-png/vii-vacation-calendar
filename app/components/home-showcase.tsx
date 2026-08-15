"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef } from "react";
import { DiscoveryCard } from "./discovery-card";
import { PropertyCard } from "./property-card";
import { eventPlaceHref, eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, paidAttractions, providerProfiles, publicWorldNavigation, spaPlaces } from "../data/world-data";
import { trails } from "../data/trail-data";
import { TrailCard } from "./trail-card";
import { PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";

function pickProperties(...slugs: string[]) {
  return slugs
    .map((slug) => properties.find((property) => property.slug === slug))
    .filter((property): property is (typeof properties)[number] => Boolean(property));
}

const lastMinutePeriods = [
  { id: "last-minute", label: "ברגע האחרון", cta: "לכל הדילים ברגע האחרון", group: "immediate", dateSummary: "9 עד 10 באוגוסט", from: "2026-08-09", till: "2026-08-10", slugs: ["aqua-resort", "ar-suites", "kesem-harimon", "ahuzat-or", "rose-estate"] },
  { id: "thursday-saturday", label: "2 לילות חמישי עד שבת", cta: "לכל הפנויים חמישי עד שבת", group: "immediate", dateSummary: "13 עד 15 באוגוסט", from: "2026-08-13", till: "2026-08-15", slugs: ["perfumes-villa", "aqua-resort", "anael-estate", "magic-garden-gefen", "kesem-harimon"] },
  { id: "friday-sunday", label: "2 לילות שישי עד ראשון", cta: "לכל הפנויים שישי עד ראשון", group: "immediate", dateSummary: "14 עד 16 באוגוסט", from: "2026-08-14", till: "2026-08-16", slugs: ["rose-estate", "ahuzat-or", "sol-gilgal", "perfumes-villa", "aqua-resort"] },
  { id: "thursday", label: "פנוי לחמישי", cta: "לכל הפנויים ליום אחד בחמישי", group: "immediate", dateSummary: "13 עד 14 באוגוסט", from: "2026-08-13", till: "2026-08-14", slugs: ["aqua-resort", "kesem-harimon", "ahuzat-or", "anael-estate", "rose-estate"] },
  { id: "friday", label: "פנוי לשישי", cta: "לכל הפנויים ליום אחד בשישי", group: "immediate", dateSummary: "14 עד 15 באוגוסט", from: "2026-08-14", till: "2026-08-15", slugs: ["ar-suites", "perfumes-villa", "magic-garden-gefen", "sol-gilgal", "aqua-resort"] },
  { id: "august", label: "אוגוסט", cta: "לכל הדילים באוגוסט", group: "upcoming", dateSummary: "20 עד 22 באוגוסט", from: "2026-08-20", till: "2026-08-22", slugs: ["aqua-resort", "perfumes-villa", "ar-suites", "kesem-harimon", "ahuzat-or"] },
  { id: "rosh-hashana", label: "ראש השנה", cta: "לכל הדילים בראש השנה", group: "upcoming", dateSummary: "11 עד 13 בספטמבר", from: "2026-09-11", till: "2026-09-13", slugs: ["anael-estate", "magic-garden-gefen", "rose-estate", "sol-gilgal", "ahuzat-or"] },
  { id: "sukkot", label: "סוכות", cta: "לכל הדילים בסוכות", group: "upcoming", dateSummary: "25 עד 27 בספטמבר", from: "2026-09-25", till: "2026-09-27", slugs: ["kesem-harimon", "aqua-resort", "anael-estate", "perfumes-villa", "rose-estate"] },
  { id: "simchat-torah", label: "שמחת תורה", cta: "לכל הדילים שמחת תורה", group: "upcoming", dateSummary: "2 עד 4 באוקטובר", from: "2026-10-02", till: "2026-10-04", slugs: ["rose-estate", "aqua-resort", "magic-garden-gefen", "ahuzat-or", "anael-estate"] },
  { id: "sigd", label: "חג הסיגד", cta: "לכל הדילים בחג הסיגד", group: "upcoming", dateSummary: "8 עד 10 בנובמבר", from: "2026-11-08", till: "2026-11-10", slugs: ["perfumes-villa", "kesem-harimon", "sol-gilgal", "ar-suites", "aqua-resort"] },
] as const;

const lastMinuteStartingPrices: Record<string, number> = {
  "aqua-resort": 3500,
  "ar-suites": 950,
  "kesem-harimon": 1200,
  "ahuzat-or": 1200,
  "rose-estate": 6000,
  "perfumes-villa": 3500,
  "anael-estate": 4800,
  "magic-garden-gefen": 2400,
  "sol-gilgal": 2200,
};

const vacationDestinations = [
  { label: "נופש בצפון", note: "גליל, גולן ונוף ירוק", href: "/vacations/north?guests=2", image: "/media/f18d7c0469633ca0.jpeg" },
  { label: "נופש בכנרת", note: "חופשה רגועה ליד המים", href: "/vacations/kinneret?guests=2", image: "/media/9a403cb4d9d1cbde.jpg" },
  { label: "נופש בירושלים", note: "הרי יהודה ואוויר הרים", href: "/vacations/jerusalem?guests=2", image: "/media/231b0e706cc61cc1.jpg" },
  { label: "נופש במרכז", note: "קרוב, נוח ובלי להתפשר", href: "/vacations/center?guests=2", image: "/media/verified/vacation/vacation-tepers-estate-1.jpg" },
  { label: "נופש בדרום", note: "מדבר, שקט ומרחבים", href: "/vacations/south-negev?guests=2", image: "/media/verified/vacation/vacation-ahuzat-shaked-1.jpeg" },
  { label: "נופש באילת", note: "שמש, ים ומקומות שלמים", href: "/vacations/eilat?guests=2", image: "/media/322de460abbda5c6.jpg" },
] as const;

const popularVacationSearches = [
  { label: "נופש למשפחה עם בריכה מחוממת", note: "מקומות שמתאימים לארבעה אורחים ומעלה", href: "/search?location=כל הארץ&guests=4&pool=1", image: "/media/cf58dc69af40c772.jpg" },
  { label: "נופש לזוג עם בריכה פרטית", note: "חופשה שקטה לשניים", href: "/search?location=כל הארץ&guests=2&pool=1", image: "/media/69e3820a7e10bc39.jpeg" },
  { label: "נופש עם ג׳קוזי וספא", note: "רוגע ופינוק בתוך מקום האירוח", href: "/search?location=כל הארץ&guests=2&spa=1", image: "/media/f18d7c0469633ca0.jpeg" },
  { label: "מקום שלם למשפחה", note: "פרטיות מלאה ומרחב משותף", href: "/search?location=כל הארץ&guests=4&whole=1", image: "/media/978e5fd5134b0831.jpeg" },
  { label: "נופש בצפון למשפחות", note: "מקומות מרווחים לארבעה אורחים ומעלה", href: "/search?location=צפון&guests=4", image: "/media/verified/vacation/vacation-villa-circle-1.jpg" },
  { label: "חופשה לקבוצה גדולה", note: "מתחמים שמתאימים ל־12 אורחים ומעלה", href: "/search?location=כל הארץ&guests=12", image: "/media/bc85b10f1d64d6db.jpeg" },
] as const;

const accommodationStyles = [
  { label: "וילות נופש", note: "בית שלם, פרטיות ומרחב", href: "/villas", image: "/media/322de460abbda5c6.jpg" },
  { label: "מתחמי סוויטות", note: "כמה יחידות סביב מתחם משותף", href: "/search?location=כל הארץ&type=מתחם סוויטות&guests=2", image: "/media/9a403cb4d9d1cbde.jpg" },
  { label: "סוויטות יוקרה", note: "עיצוב מוקפד וחופשה מפנקת", href: "/search?location=כל הארץ&type=סוויטות יוקרה&guests=2", image: "/media/f18d7c0469633ca0.jpeg" },
  { label: "מתחמי נופש", note: "אפשרויות אירוח לקבוצות ומשפחות", href: "/search?location=כל הארץ&type=מתחם נופש&guests=4", image: "/media/verified/vacation/vacation-como-boutique-1.jpeg" },
  { label: "אירוח רומנטי לזוגות", note: "מקומות אינטימיים לחופשה בשניים", href: "/search?location=כל הארץ&guests=2", image: "/media/231b0e706cc61cc1.jpg" },
  { label: "אירוח למשפחות", note: "מרחב, בריכה וחדרים לכולם", href: "/search?location=כל הארץ&guests=5", image: "/media/cf58dc69af40c772.jpg" },
] as const;

function lastMinuteHref(period: (typeof lastMinutePeriods)[number]) {
  return `/search?period=${encodeURIComponent(period.id)}&from=${period.from}&till=${period.till}&guests=2`;
}

function SliderControls({ onPrevious, onNext, label }: { onPrevious: () => void; onNext: () => void; label: string }) {
  return <div className="home-slider__controls" aria-label={`דפדוף ${label}`}><button type="button" onClick={onPrevious} aria-label={`הקודם, ${label}`}>הקודם</button><button type="button" onClick={onNext} aria-label={`הבא, ${label}`}>הבא</button></div>;
}

function reviewExcerpt(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 118) return normalized;
  const candidate = normalized.slice(0, 119);
  const lastWord = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastWord > 82 ? lastWord : 118).trim()}...`;
}

const ratingCardCopy = {
  en: {
    "spa-head-spa-nahariya": { name: "Lorensa Head Spa, Nahariya", summary: "A women-only Japanese head spa and deep healing experience designed for calm, release and genuine personal renewal..." },
    "spa-spa-nucha": { name: "Adama Spa at Nucha Hotel", summary: "A quiet Jerusalem hotel spa with aromatic treatments, a rooftop pool and an intimate atmosphere for a complete break..." },
    "spa-salt-rooms": { name: "Salt Rooms, Breathing and Touch Center", summary: "A calming salt-room experience complemented by massages and energy treatments for breathing, relaxation and renewal..." },
    "spa-prince-spa-tiberias": { name: "Prince Spa Tiberias", summary: "A peaceful spa retreat in Tiberias for slowing down, reconnecting and enjoying a naturally relaxing experience..." },
    "debrah-spa": { name: "Debrah Spa by Adama", summary: "Hotel treatment rooms with individual and couples packages available through convenient online booking..." },
    "bobo-spa": { name: "Bobo Spa by Adama", summary: "Spacious treatment rooms and comfortable relaxation areas at the Bobo Hotel on Yavne Street..." },
    "spa-villa-brown-jerusalem-spa": { name: "Villa Brown Jerusalem Spa", summary: "A boutique hotel spa with an equipped treatment room, rooftop terrace, city views and an outdoor relaxation area..." },
  },
  ru: {
    "spa-head-spa-nahariya": { name: "Lorensa Head Spa, Нагария", summary: "Японский спа для головы и глубокое расслабление в пространстве только для женщин, созданном для спокойствия и обновления..." },
    "spa-spa-nucha": { name: "Adama Spa в отеле Nucha", summary: "Тихий спа в Иерусалиме с ароматическими процедурами, бассейном на крыше и уютной атмосферой для полноценного отдыха..." },
    "spa-salt-rooms": { name: "Соляные комнаты, центр дыхания и прикосновения", summary: "Спокойная соляная комната, массажи и дополнительные энергетические процедуры для дыхания, расслабления и восстановления..." },
    "spa-prince-spa-tiberias": { name: "Prince Spa Тверия", summary: "Спокойный спа в Тверии, где можно отвлечься от рутины, восстановить силы и насладиться естественным расслаблением..." },
    "debrah-spa": { name: "Debrah Spa от сети Adama", summary: "Процедурные кабинеты в отеле и пакеты для одного или пары с удобным онлайн-бронированием..." },
    "bobo-spa": { name: "Bobo Spa от сети Adama", summary: "Просторные процедурные кабинеты и комфортные зоны отдыха в отеле Bobo на улице Явне..." },
    "spa-villa-brown-jerusalem-spa": { name: "Villa Brown Spa, Иерусалим", summary: "Спа бутик-отеля с оборудованным кабинетом, террасой на крыше, видом на город и открытой зоной отдыха..." },
  },
  fr: {
    "spa-head-spa-nahariya": { name: "Lorensa Head Spa, Nahariya", summary: "Un spa japonais du cuir chevelu réservé aux femmes, pensé pour la détente profonde, le lâcher-prise et le renouveau..." },
    "spa-spa-nucha": { name: "Adama Spa à l’hôtel Nucha", summary: "Un spa paisible à Jérusalem avec soins aromatiques, piscine sur le toit et ambiance intime pour une vraie pause..." },
    "spa-salt-rooms": { name: "Salles de sel, centre de respiration et de toucher", summary: "Une expérience apaisante en salle de sel, complétée par des massages et des soins énergétiques pour se ressourcer..." },
    "spa-prince-spa-tiberias": { name: "Prince Spa Tibériade", summary: "Une parenthèse paisible à Tibériade pour ralentir, se reconnecter et profiter d’une expérience naturellement relaxante..." },
    "debrah-spa": { name: "Debrah Spa par Adama", summary: "Des salles de soins à l’hôtel et des formules individuelles ou en duo avec réservation en ligne..." },
    "bobo-spa": { name: "Bobo Spa par Adama", summary: "Des salles de soins spacieuses et des espaces de repos confortables à l’hôtel Bobo, rue Yavne..." },
    "spa-villa-brown-jerusalem-spa": { name: "Villa Brown Spa, Jérusalem", summary: "Un spa d’hôtel boutique avec salle de soins, terrasse sur le toit, vue sur la ville et espace détente extérieur..." },
  },
} as const;

export function HomeShowcase() {
  const tracks = useRef<Record<string, HTMLDivElement | null>>({});
  const { language } = useSiteLanguage();
  const worldCards = publicWorldNavigation.filter((world) => !["vacation", "events", "spa", "hourly"].includes(world.id));
  const recommendedPlaces = pickProperties("aqua-resort", "kesem-harimon", "ahuzat-or", "anael-estate", "magic-garden-gefen", "perfumes-villa", "rose-estate");
  const immediatePeriod = lastMinutePeriods.find((period) => period.group === "immediate")!;
  const upcomingPeriod = lastMinutePeriods.find((period) => period.group === "upcoming")!;
  const dealGroups = [
    { id: "last-minute-deals", title: "דילים ברגע האחרון", period: immediatePeriod, periods: lastMinutePeriods.filter((period) => period.group === "immediate") },
    { id: "popular-periods", title: "דילים לתקופות מבוקשות", period: upcomingPeriod, periods: lastMinutePeriods.filter((period) => period.group === "upcoming") },
  ];
  const featuredTours = properties.flatMap((property) => (property.videos || []).map((video) => ({ property, video }))).slice(0, 7);
  const topRatedPlaces = [...spaPlaces].filter((item) => item.rating).sort((first, second) => (second.rating || 0) - (first.rating || 0)).slice(0, 7);

  function scroll(id: string, direction: "previous" | "next") {
    const track = tracks.current[id];
    if (!track) return;
    const firstItem = track.querySelector<HTMLElement>(".home-slider__item, .home-last-minute__cards > a");
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap) || 0;
    const step = firstItem ? firstItem.getBoundingClientRect().width + gap : track.clientWidth;
    const isRtl = window.getComputedStyle(track).direction === "rtl";
    const forward = isRtl ? -step : step;
    track.scrollBy({ left: direction === "next" ? forward : -forward, behavior: "smooth" });
  }

  return <>
    <section className="section home-recommended" aria-labelledby="home-recommended-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">המקומות שעושים חשק לארוז</span><h2 id="home-recommended-title">מומלצים שכדאי להכיר</h2><p>מקומות אמיתיים מתוך האתר, עם חדרים, מתקנים וכל המידע שצריך לפני שבוחרים.</p></div><div><Link href="/search">לכל המקומות</Link><SliderControls label="מקומות מומלצים" onPrevious={() => scroll("recommended", "previous")} onNext={() => scroll("recommended", "next")} /></div></div>
        <div className="home-slider__track home-slider__track--properties" data-horizontal-rail ref={(node) => { tracks.current.recommended = node; }}>{recommendedPlaces.map((property) => <div className="home-slider__item" key={property.slug}><PropertyCard property={property} promotional /></div>)}</div>
      </div>
    </section>

    <section className="section home-last-minute" aria-labelledby="last-minute-title">
      <div className="shell">
        <div className="home-last-minute__intro"><span className="eyebrow">הזמינות הקרובה באתר</span><h2 id="last-minute-title">כל הדילים במקום אחד</h2></div>
        {dealGroups.map((group) => <section className="home-last-minute__slider" key={group.id} aria-labelledby={`${group.id}-title`}>
          <div className="home-last-minute__slider-head"><div><h3 id={`${group.id}-title`}>{group.title}</h3><nav className="home-last-minute__tabs" aria-label={group.title}>{group.periods.map((period) => <Link key={period.id} href={lastMinuteHref(period)}>{period.label}</Link>)}</nav></div><div><Link href={lastMinuteHref(group.period)}>{group.period.cta}</Link><SliderControls label={group.title} onPrevious={() => scroll(group.id, "previous")} onNext={() => scroll(group.id, "next")} /></div></div>
          <div className="home-last-minute__cards" data-horizontal-rail ref={(node) => { tracks.current[group.id] = node; }}>{pickProperties(...group.period.slugs).map((property) => {
            const price = property.price || lastMinuteStartingPrices[property.slug] || 1200;
            const detailHref = `/business?id=${property.slug}&period=${encodeURIComponent(group.period.id)}&from=${group.period.from}&till=${group.period.till}&guests=2&price=${price}`;
            return <Link key={property.slug} href={detailHref}><img src={property.image} alt={property.name} title={property.name} loading="lazy" decoding="async" /><span>{group.period.label}</span><div><small><PinIcon />{property.location}</small><h3>{property.name}</h3><div className="home-last-minute__deal"><b>{group.period.dateSummary}</b><strong>{price.toLocaleString("he-IL")} ₪</strong></div></div></Link>;
          })}</div>
        </section>)}
      </div>
    </section>

    <section className="section home-vacation-discovery" aria-labelledby="vacation-discovery-title">
      <div className="shell">
        <div className="home-vacation-discovery__intro">
          <span className="eyebrow">מכאן קל יותר לבחור</span>
          <h2 id="vacation-discovery-title">מוצאים את הנופש בדרך שמתאימה לכם</h2>
          <p>מתחילים באזור, בהרכב או בסגנון האירוח, ומגיעים ישר לתוצאות המתאימות.</p>
        </div>

        <div className="home-vacation-strip">
          <div className="home-vacation-strip__head"><div><span>לפי אזור</span><h3>יעדים מומלצים לנופש</h3></div><SliderControls label="יעדי נופש" onPrevious={() => scroll("destinations", "previous")} onNext={() => scroll("destinations", "next")} /></div>
          <div className="home-vacation-strip__track home-vacation-strip__track--destinations" data-horizontal-rail ref={(node) => { tracks.current.destinations = node; }}>
            {vacationDestinations.map((item) => <Link className="home-vacation-card home-vacation-card--destination home-slider__item" href={item.href} key={item.label}><img src={item.image} alt="" loading="lazy" decoding="async" /><div><span>יעד מומלץ</span><h4>{item.label}</h4><p>{item.note}</p><b>לכל המקומות באזור</b></div></Link>)}
          </div>
        </div>

        <div className="home-vacation-strip">
          <div className="home-vacation-strip__head"><div><span>לפי מה שחשוב בחופשה</span><h3>חיפושים נפוצים</h3></div><SliderControls label="חיפושים נפוצים" onPrevious={() => scroll("popular-searches", "previous")} onNext={() => scroll("popular-searches", "next")} /></div>
          <div className="home-vacation-strip__track" data-horizontal-rail ref={(node) => { tracks.current["popular-searches"] = node; }}>
            {popularVacationSearches.map((item, index) => <Link className="home-vacation-card home-vacation-card--search home-slider__item" href={item.href} key={item.label}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><small>חיפוש פופולרי</small><h4>{item.label}</h4><p>{item.note}</p><b>לצפייה במקומות</b></div></Link>)}
          </div>
        </div>

        <div className="home-vacation-strip">
          <div className="home-vacation-strip__head"><div><span>סוגים וסגנונות אירוח</span><h3>מה אתם מחפשים?</h3></div><SliderControls label="סוגי אירוח" onPrevious={() => scroll("stay-types", "previous")} onNext={() => scroll("stay-types", "next")} /></div>
          <div className="home-vacation-strip__track" data-horizontal-rail ref={(node) => { tracks.current["stay-types"] = node; }}>
            {accommodationStyles.map((item) => <Link className="home-vacation-card home-vacation-card--style home-slider__item" href={item.href} key={item.label}><img src={item.image} alt="" loading="lazy" decoding="async" /><div><span>סגנון אירוח</span><h4>{item.label}</h4><p>{item.note}</p><b>לכל המקומות</b></div></Link>)}
          </div>
        </div>
      </div>
    </section>

    <section className="section home-trust-discovery" aria-labelledby="home-tours-title">
      <div className="shell">
        <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>רואים לפני שבוחרים</span><h2 id="home-tours-title">סרטונים מובילים</h2></div><SliderControls label="סרטונים מובילים" onPrevious={() => scroll("tours", "previous")} onNext={() => scroll("tours", "next")} /></div>
          <div className="home-slider__track home-slider__track--trust" data-horizontal-rail ref={(node) => { tracks.current.tours = node; }}>
            {featuredTours.map(({ property, video }) => <article className="home-tour-card home-slider__item" key={`${property.slug}-${video.src}`}>
              <video controls playsInline preload="none" poster={video.poster} aria-label={`${video.title}, ${property.name}`}><source src={video.src} type="video/mp4" /></video>
              <div><span>{property.location}</span><h3>{property.name}</h3><p>{video.note}</p><Link href={`/business?id=${property.slug}`}>לפרטי המקום</Link></div>
            </article>)}
          </div>
        </div>

        <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>דירוגים ממקור המידע של המקום</span><h2 id="home-ratings-title">חוות דעת מובילות</h2></div><SliderControls label="חוות דעת מובילות" onPrevious={() => scroll("ratings", "previous")} onNext={() => scroll("ratings", "next")} /></div>
          <div className="home-slider__track home-slider__track--trust home-slider__track--ratings" data-horizontal-rail ref={(node) => { tracks.current.ratings = node; }} aria-labelledby="home-ratings-title">
            {topRatedPlaces.map((item) => {
              const localized = language === "he" ? null : ratingCardCopy[language][item.id as keyof (typeof ratingCardCopy)[typeof language]];
              return <Link className="home-rating-card home-slider__item" href={`/discover/place/${item.id}`} key={item.id}>
                <div className="home-rating-card__top"><img src={item.image} alt="" loading="lazy" decoding="async" /><div><span>{item.location}</span><h3>{localized?.name || item.name}</h3><strong aria-label={`${item.rating} מתוך 10`}><b>{item.rating}</b><i aria-hidden="true">★★★★★</i></strong></div></div><p>{localized?.summary || reviewExcerpt(item.description)}</p><b className="home-rating-card__cta">לפרטי המקום</b>
              </Link>;
            })}
          </div>
        </div>
      </div>
    </section>

    <section className="section home-spa-strip" aria-labelledby="home-spa-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוצרים לנשום</span><h2 id="home-spa-title">ספא ורוגע, כחלק מהחופשה</h2></div><div><Link href="/spas">לכל מתחמי הספא</Link><SliderControls label="מתחמי ספא" onPrevious={() => scroll("spa", "previous")} onNext={() => scroll("spa", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" data-horizontal-rail ref={(node) => { tracks.current.spa = node; }}>{spaPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="section home-short-stay" aria-labelledby="home-short-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">כשלא צריך לילה שלם</span><h2 id="home-short-title">חדרים לכמה שעות</h2><p>שהייה קצרה, פרטית וגמישה. בוחרים מקום ובודקים את מסגרת הזמן והמחיר.</p></div><div><Link href="/hourly">לכל החדרים</Link><SliderControls label="חדרים לפי שעה" onPrevious={() => scroll("hourly", "previous")} onNext={() => scroll("hourly", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" data-horizontal-rail ref={(node) => { tracks.current.hourly = node; }}>{hourlyPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="home-events-world" aria-labelledby="home-events-title">
      <div className="shell home-events-world__head"><div><span className="eyebrow">עולם האירועים</span><h2 id="home-events-title">כל סיבה טובה הופכת כאן לאירוע</h2><p>לופטים ומתחמים לימי הולדת, מסיבות, אירועי חברה וחגיגות פרטיות, עם חיפוש לפי כמות ואופי האירוע.</p></div><Link className="button" href="/events">נכנסים לעולם האירועים</Link></div>
      <div className="shell home-events-world__layout">
        <Link className="home-event-feature" href={eventPlaceHref(eventPlaces[3])}><img src={eventPlaces[3].image} alt={eventPlaces[3].name} title={eventPlaces[3].name} loading="lazy" decoding="async" /><span>{eventPlaces[3].type}</span><div><small><PinIcon />{eventPlaces[3].location}</small><h3>{eventPlaces[3].name}</h3><p>{eventPlaces[3].description}</p><b>עד {eventPlaces[3].guests} אורחים</b></div></Link>
        <div className="home-event-list">{eventPlaces.filter((place) => ![eventPlaces[0].slug,eventPlaces[3].slug].includes(place.slug)).slice(0,4).map((place) => <Link key={place.slug} href={eventPlaceHref(place)}><img src={place.image} alt={place.name} title={place.name} loading="lazy" decoding="async" /><div><span>{place.type}</span><h3>{place.name}</h3><small>{place.location}, עד {place.guests} אורחים</small></div></Link>)}</div>
      </div>
    </section>

    <section className="section home-worlds" aria-labelledby="home-worlds-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">אתר אחד, הרבה דרכים ליהנות</span><h2 id="home-worlds-title">ממשיכים לכל העולמות</h2><p>לא רק מקום לישון. בונים את כל החופשה, הטיפול, השהייה הקצרה, הספקים והיום שמסביב.</p></div></div>
        <div className="home-world-gates">{worldCards.map((world) => {
          const item = world.id === "providers" ? providerProfiles[0] : world.id === "trails" ? trails[0] : paidAttractions[0];
          const image = "image" in item ? item.image : undefined;
          const description = "description" in item ? item.description : item.summary;
          return <Link key={world.id} className={`home-world-gate home-world-gate--${world.id}`} href={world.href}>{image ? <img src={image} alt={item.name} title={item.name} loading="lazy" decoding="async" /> : <span className="home-world-gate__visual">{world.shortLabel.slice(0,1)}</span>}<div><span>{world.label}</span><h3>{world.description}</h3><p>{"demo" in item && item.demo ? "פרופילים לדוגמה שממחישים איך השירות יעבוד באתר." : description}</p><b>לגלות את העולם</b></div></Link>;
        })}</div>
      </div>
    </section>

  </>;
}

export function HomeTrails() {
  return <section className="section home-trails" aria-labelledby="home-trails-title">
    <div className="shell"><div className="section-head"><div><span className="eyebrow">יוצאים מהצימר אל הטבע</span><h2 id="home-trails-title">מסלולים ליד החופשה</h2><p>מדריכי טיול עצמאיים עם זמן, קושי, עונה, בטיחות ומקור רשמי לבדיקה ביום היציאה.</p></div><Link href="/trails">לכל המסלולים</Link></div>
      <div className="trail-grid trail-grid--home">{trails.slice(0, 4).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div>
    </div>
  </section>;
}
