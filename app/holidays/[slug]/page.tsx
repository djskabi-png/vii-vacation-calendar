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
import { runtimeDatabase } from "../../lib/runtime-database.ts";
import "../holiday-world.css";
import { serverLocalePath, serverPublicCopy } from "../../i18n/server-public-copy";

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function database(): Promise<D1Database | null> {
  try { return await runtimeDatabase() || null; }
  catch { return null; }
}

async function holidayForSlug(slug: string) {
  const holidays = await getHomeHolidays({ token: await supplierToken() }).catch(() => []);
  const legacyId = /^holiday-(\d+)$/.exec(slug)?.[1];
  return holidays.find((holiday) => holidaySlug(holiday.name, holiday.id) === slug || (legacyId && holiday.id === Number(legacyId))) || fallbackHolidayForSlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const holiday = await holidayForSlug(slug);
  if (!holiday) return { robots: { index: false, follow: false } };
  const { language, translate } = await serverPublicCopy();
  const source = await readHolidayWorld(holiday, await database(), language);
  const world = { ...source, metaTitle: translate(source.metaTitle), metaDescription: translate(source.metaDescription), heroImageAlt: translate(source.heroImageAlt) };
  const canonical = await serverLocalePath(`/holidays/${world.slug}`);
  return { title: world.metaTitle, description: world.metaDescription, robots: { index: world.indexable, follow: true }, alternates: { canonical },
    openGraph: { type: "website", url: canonical, title: world.metaTitle, description: world.metaDescription, images: [{ url: world.heroImage, alt: world.heroImageAlt }] } };
}

export default async function HolidayPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const holiday = await holidayForSlug(slug);
  if (!holiday) notFound();
  const { language, translate } = await serverPublicCopy();
  const source = await readHolidayWorld(holiday, await database(), language);
  const world = { ...source, name: translate(source.name), title: translate(source.title), summary: translate(source.summary), body: translate(source.body), proof: source.proof.map(translate) };
  const heroMobileImage = world.heroImage.startsWith("/images/holidays/") ? world.heroImage.replace(/\.webp$/, "-mobile.webp") : world.heroImage;
  const query = await searchParams;
  const selection = holidaySelection({ get: (name) => typeof query?.[name] === "string" ? query[name] as string : null }, holiday);
  const faqs = [
    { question: translate(`מתי ${source.name} ${world.year}?`), answer: world.proof[0] },
    { question: translate(`איך מוצאים מקום פנוי ל${source.name}?`), answer: translate("בוחרים תאריכים והרכב אורחים ורואים את המקומות הפנויים והמחירים המתאימים.") },
    { question: translate("אפשר לחפש מקום לקבוצה גדולה?"), answer: translate("כן. החיפוש לקבוצות מוגדר לעד 20 אורחים, ובעמוד התוצאות אפשר לשנות את מספר האורחים בהתאם להרכב המדויק.") },
  ];
  return <PageShell variant="vacation" footerTopic="vacation-villas">
    <main id="main-content" className="holiday-world">
      <StructuredData data={breadcrumbSchema([{ name: translate("ראשי"), path: "/" }, { name: translate("נופש בחג"), path: "/holidays" }, { name: world.name, path: `/holidays/${world.slug}` }])} />
      <StructuredData data={faqSchema(faqs)} />
      <section className="holiday-hero">
        <div className="shell holiday-hero__frame">
          <div className="holiday-hero__content">
            <BreadcrumbTrail items={[{ name: translate("ראשי"), path: "/" }, { name: translate("נופש בחג"), path: "/holidays" }, { name: world.name }]} />
            <h1>{world.title}</h1>
            <p>{world.summary}</p>
            <div className="holiday-hero__proof" aria-label={translate("חגים ומועדים")}>{world.proof.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
          <div className="holiday-hero__media">
            <picture>
              <source media="(max-width: 760px)" srcSet={heroMobileImage} />
              <img src={world.heroImage} alt={translate(world.heroImageAlt)} width="1600" height="900" loading="eager" fetchPriority="high" decoding="async" />
            </picture>
          </div>
        </div>
      </section>

      <HolidayLiveDeals holiday={holiday} initialSelection={selection} />

      <section className="section shell holiday-story" aria-labelledby="holiday-story-title"><div><span className="eyebrow">{translate("מתכננים בלי לנחש")}</span><h2 id="holiday-story-title">{translate("מה חשוב לדעת לפני שסוגרים?")}</h2><p>{world.body}</p></div><ol><li><b>01</b><span><strong>{translate("בוחרים חלון")}</strong>{translate("לא חייבים לחפש את כל ימי החג יחד.")}</span></li><li><b>02</b><span><strong>{translate("מגדירים הרכב")}</strong>{translate("מספר האורחים משפיע על המקומות ועל המחיר.")}</span></li><li><b>03</b><span><strong>{translate("בודקים בזמן אמת")}</strong>{translate("משווים מקומות פנויים לתאריכים ולהרכב שבחרתם.")}</span></li></ol></section>

      <section className="section section-tint holiday-faq"><div className="shell"><div className="holiday-section-head"><div><span className="eyebrow">{translate("תשובות קצרות לפני שיוצאים")}</span><h2>{translate(`שאלות על נופש ב${source.name}`)}</h2></div></div><div className="holiday-faq__list">{faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </PageShell>;
}
