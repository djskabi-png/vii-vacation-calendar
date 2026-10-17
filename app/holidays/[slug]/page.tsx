/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "../../components/page-shell.tsx";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail.tsx";
import { StructuredData } from "../../components/structured-data.tsx";
import { HolidayLiveDeals } from "../../components/holiday-live-deals.tsx";
import { breadcrumbSchema, faqSchema } from "../../lib/seo.ts";
import { fallbackHolidayForSlug, holidaySlug, readHolidayWorld } from "../../lib/holiday-world.ts";
import { holidaySelection } from "../../lib/holiday-deal-selection.ts";
import { getHomeHolidays } from "../../lib/vii-home-holidays.ts";
import { supplierToken } from "../../lib/vii-supplier-token.ts";
import type { D1Database } from "../../../types/cloudflare-runtime.ts";
import "../holiday-world.css";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function database(): Promise<D1Database | null> {
  try { const runtimeName = "cloudflare:workers"; const runtime = await import(/* @vite-ignore */ runtimeName); return (runtime.env as unknown as { DB?: D1Database }).DB || null; }
  catch { return null; }
}

async function holidayForSlug(slug: string) {
  const holidays = await getHomeHolidays({ token: await supplierToken() }).catch(() => []);
  return holidays.find((holiday) => holidaySlug(holiday.name, holiday.id) === slug) || fallbackHolidayForSlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const holiday = await holidayForSlug(slug);
  if (!holiday) return { robots: { index: false, follow: false } };
  const world = await readHolidayWorld(holiday, await database());
  const canonical = `/holidays/${world.slug}`;
  return { title: world.metaTitle, description: world.metaDescription, robots: { index: world.indexable, follow: true }, alternates: { canonical },
    openGraph: { type: "website", url: canonical, title: world.metaTitle, description: world.metaDescription, images: [{ url: world.heroImage, alt: world.heroImageAlt }] } };
}

export default async function HolidayPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const holiday = await holidayForSlug(slug);
  if (!holiday) notFound();
  const world = await readHolidayWorld(holiday, await database());
  const query = await searchParams;
  const selection = holidaySelection({ get: (name) => typeof query?.[name] === "string" ? query[name] as string : null });
  const faqs = [
    { question: `מתי ${world.name} ${world.year}?`, answer: world.proof[0] },
    { question: `איך מוצאים מקום פנוי ל${world.name}?`, answer: "בוחרים כאן חלון תאריכים והרכב. בעמוד התוצאות VII בודקת זמינות ומחיר מול המערכת לפני הצגת דיל מאומת." },
    { question: "אפשר לחפש מקום לקבוצה גדולה?", answer: "כן. החיפוש לקבוצות מוגדר לעד 20 אורחים, ובעמוד התוצאות אפשר לשנות את מספר האורחים בהתאם להרכב המדויק." },
  ];
  return <PageShell variant="vacation" footerTopic="vacation-villas">
    <main id="main-content" className="holiday-world">
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "חגים ומועדים", path: "/search" }, { name: world.name, path: `/holidays/${world.slug}` }])} />
      <StructuredData data={faqSchema(faqs)} />
      <section className="holiday-hero">
        <div className="shell">
          <div className="holiday-hero__content">
            <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "חגים ומועדים", path: "/search" }, { name: world.name }]} />
            <h1>{world.title}</h1>
            <p>{world.summary}</p>
            <div className="holiday-hero__proof" aria-label={`פרטי ${world.name}`}>{world.proof.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        </div>
      </section>

      <HolidayLiveDeals holiday={holiday} initialSelection={selection} />

      <section className="section shell holiday-story" aria-labelledby="holiday-story-title"><div><span className="eyebrow">מתכננים בלי לנחש</span><h2 id="holiday-story-title">מה חשוב לדעת לפני שסוגרים?</h2><p>{world.body}</p></div><ol><li><b>01</b><span><strong>בוחרים חלון</strong>לא חייבים לחפש את כל ימי החג יחד.</span></li><li><b>02</b><span><strong>מגדירים הרכב</strong>מספר האורחים משפיע על המקומות ועל המחיר.</span></li><li><b>03</b><span><strong>בודקים בזמן אמת</strong>רק תוצאה שחזרה מהמערכת מוצגת כדיל פנוי.</span></li></ol></section>

      <section className="section section-tint holiday-faq"><div className="shell"><div className="holiday-section-head"><div><span className="eyebrow">תשובות קצרות לפני שיוצאים</span><h2>שאלות על נופש ב{world.name}</h2></div></div><div className="holiday-faq__list">{faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </PageShell>;
}
