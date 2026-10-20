import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ArrowLeft } from "lucide-react";
import { PageShell } from "../components/page-shell";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { getHomeHolidays } from "../lib/vii-home-holidays";
import { holidayWorldPath } from "../lib/holiday-world";
import { supplierToken } from "../lib/vii-supplier-token";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { localizedPath } from "../i18n/locale-routing";
import "./holiday-world.css";

const copy = {
  he: { eyebrow: "מתכננים את החופשה הבאה", title: "נופש בחג", intro: "בוחרים חג קרוב, רואים את התאריכים וממשיכים ישר למקומות הפנויים להרכב שלכם.", upcoming: "החגים הקרובים", open: "לנופש בחג", empty: "אין כרגע חגים קרובים להצגה.", search: "לחיפוש נופש", planTitle: "מתחילים מהחג, מסיימים במקום שמתאים לכם", plan: ["תאריך ברור", "הרכב אורחים", "זמינות ומחיר"] },
  en: { eyebrow: "Plan your next break", title: "Holiday escapes", intro: "Choose an upcoming holiday, see the dates and continue directly to available stays for your party.", upcoming: "Upcoming holidays", open: "Explore stays", empty: "There are no upcoming holidays to show right now.", search: "Search stays", planTitle: "Start with the holiday, finish with the right stay", plan: ["Clear dates", "Guest party", "Availability and price"] },
  ru: { eyebrow: "Планируем следующую поездку", title: "Отдых в праздники", intro: "Выберите ближайший праздник, проверьте даты и перейдите к свободным вариантам для вашей компании.", upcoming: "Ближайшие праздники", open: "Смотреть отдых", empty: "Сейчас нет ближайших праздников для показа.", search: "Поиск отдыха", planTitle: "От праздника к подходящему месту", plan: ["Точные даты", "Состав гостей", "Наличие и цена"] },
  fr: { eyebrow: "Préparez votre prochaine escapade", title: "Séjours pendant les fêtes", intro: "Choisissez une fête à venir, consultez les dates et accédez aux séjours disponibles pour votre groupe.", upcoming: "Fêtes à venir", open: "Voir les séjours", empty: "Aucune fête à venir n’est disponible pour le moment.", search: "Rechercher un séjour", planTitle: "De la fête au séjour qui vous convient", plan: ["Dates claires", "Composition du groupe", "Disponibilité et prix"] },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await serverPublicCopy();
  const text = copy[language];
  return {
    title: text.title,
    description: text.intro,
    alternates: { canonical: localizedPath("/holidays", language) },
  };
}

export default async function HolidaysPage() {
  const { language, translate } = await serverPublicCopy();
  const text = copy[language];
  const holidays = await supplierToken().then((token) => getHomeHolidays({ token })).catch(() => []);
  const format = new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const date = (value: string) => format.format(new Date(`${value}T00:00:00Z`));
  const items = holidays.map((holiday) => ({ name: translate(holiday.name), path: holidayWorldPath(holiday.name, holiday.id) }));
  return <PageShell variant="vacation" footerTopic="vacation-villas">
    <main id="main-content" className="holiday-world holiday-hub">
      <StructuredData data={breadcrumbSchema([{ name: translate("ראשי"), path: "/" }, { name: text.title, path: "/holidays" }])} />
      <StructuredData data={collectionSchema(text.title, text.intro, "/holidays", items)} />
      <section className="holiday-hub__hero"><div className="shell">
        <BreadcrumbTrail items={[{ name: translate("ראשי"), path: "/" }, { name: text.title }]} />
        <span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.intro}</p>
        <div className="holiday-hub__steps" aria-label={text.planTitle}>{text.plan.map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</div>
      </div></section>
      <section className="section shell holiday-hub__upcoming" aria-labelledby="upcoming-holidays-title">
        <div className="holiday-section-head"><span className="eyebrow">{text.upcoming}</span><h2 id="upcoming-holidays-title">{text.planTitle}</h2></div>
        {holidays.length ? <div className="holiday-hub__grid">{holidays.map((holiday, index) => {
          const href = localizedPath(holidayWorldPath(holiday.name, holiday.id), language);
          return <article key={holiday.id} className={`holiday-hub__card holiday-hub__card--${index % 4}`}>
            <div className="holiday-hub__date"><CalendarDays aria-hidden="true" /><span><time dateTime={holiday.from}>{date(holiday.from)}</time><i aria-hidden="true">/</i><time dateTime={holiday.till}>{date(holiday.till)}</time></span></div>
            <h3>{translate(holiday.name)}</h3><p>{holiday.nights} {translate("לילות")} · {translate("לזוגות, משפחות וקבוצות")}</p>
            <Link href={href}>{text.open}<ArrowLeft aria-hidden="true" /></Link>
          </article>;
        })}</div> : <div className="holiday-hub__empty"><p>{text.empty}</p><Link className="button primary" href={localizedPath("/search", language)}>{text.search}</Link></div>}
      </section>
    </main>
  </PageShell>;
}
