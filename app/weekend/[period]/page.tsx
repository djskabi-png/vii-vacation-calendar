import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { HomeLiveDeals } from "../../components/home-live-deals";
import { PageShell } from "../../components/page-shell";
import { StructuredData } from "../../components/structured-data";
import { localizedPath } from "../../i18n/locale-routing";
import { serverPublicCopy } from "../../i18n/server-public-copy";
import { isWeekendLandingSlug, weekendLandingPeriods, type WeekendLandingSlug } from "../../lib/home-period-landings";
import { breadcrumbSchema, faqSchema } from "../../lib/seo";
import "../../holidays/holiday-world.css";
import "../../last-minute/last-minute.css";

const hebrewCopy: Record<WeekendLandingSlug, { title: string; metaTitle: string; description: string; intro: string; results: string; faq: [string, string][] }> = {
  "thursday-to-saturday": { title: "נופש מחמישי עד שבת בסוף השבוע הקרוב", metaTitle: "נופש מחמישי עד שבת בסוף השבוע הקרוב | זמינות ומחירים", description: "מקומות נופש פנויים מחמישי עד שבת בסוף השבוע הקרוב, עם מחיר לכל השהייה ודרך ישירה לבדוק ולהזמין.", intro: "מקומות שנבדקו לשני לילות, מחמישי עד שבת, מסודרים לפי זמינות, מחיר ואפשרות הזמנה.", results: "מקומות פנויים מחמישי עד שבת", faq: [["לאילו תאריכים העמוד מתייחס?", "לסוף השבוע הקרוב, מחמישי עד שבת. התאריכים המדויקים מופיעים בכל הצעה."], ["המחיר הוא לכל התקופה?", "כן. כאשר מוצג מחיר הוא מתייחס להרכב ולכל השהייה שנבדקה, אלא אם צוין אחרת."]] },
  "friday-to-sunday": { title: "נופש משישי עד ראשון בסוף השבוע הקרוב", metaTitle: "נופש משישי עד ראשון בסוף השבוע הקרוב | זמינות ומחירים", description: "מקומות נופש פנויים משישי עד ראשון בסוף השבוע הקרוב, עם מחיר לכל השהייה ודרך ישירה לבדוק ולהזמין.", intro: "מקומות שנבדקו לשני לילות, משישי עד ראשון, מסודרים לפי זמינות, מחיר ואפשרות הזמנה.", results: "מקומות פנויים משישי עד ראשון", faq: [["לאילו תאריכים העמוד מתייחס?", "לסוף השבוע הקרוב, משישי עד ראשון. התאריכים המדויקים מופיעים בכל הצעה."], ["האם הזמינות נבדקת שוב?", "כן. לפני השלמת הזמנה מתבצעת בדיקה נוספת של היחידה, המחיר והתנאים."]] },
  "thursday-night": { title: "נופש ללילה בחמישי בסוף השבוע הקרוב", metaTitle: "נופש ללילה בחמישי בסוף השבוע הקרוב | מקומות פנויים", description: "מקומות נופש פנויים ללילה בחמישי בסוף השבוע הקרוב, עם מחירים ופרטי הזמנה.", intro: "מקומות שנבדקו ללילה הקרוב של יום חמישי, עם מחיר ותנאים להרכב שנבחר.", results: "מקומות פנויים ללילה בחמישי", faq: [["האם זה עמוד ללילה אחד?", "כן. ההצעות נבדקות ללילה שבין חמישי לשישי בסוף השבוע הקרוב."], ["איך יודעים שהמקום עדיין פנוי?", "הזמינות מוצגת לאחר בדיקה ונבדקת שוב לפני ההזמנה."]] },
  "friday-night": { title: "נופש ללילה בשישי בסוף השבוע הקרוב", metaTitle: "נופש ללילה בשישי בסוף השבוע הקרוב | מקומות פנויים", description: "מקומות נופש פנויים ללילה בשישי בסוף השבוע הקרוב, עם מחירים ופרטי הזמנה.", intro: "מקומות שנבדקו ללילה הקרוב של יום שישי, עם מחיר ותנאים להרכב שנבחר.", results: "מקומות פנויים ללילה בשישי", faq: [["האם זה עמוד ללילה אחד?", "כן. ההצעות נבדקות ללילה שבין שישי לשבת בסוף השבוע הקרוב."], ["המחיר שמופיע סופי?", "המחיר מתייחס להרכב שנבדק ונבדק שוב יחד עם הזמינות לפני ההזמנה."]] },
};

function resolvePeriod(value: string) {
  if (!isWeekendLandingSlug(value)) notFound();
  return value;
}

export function generateStaticParams() {
  return Object.keys(weekendLandingPeriods).map((period) => ({ period }));
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }): Promise<Metadata> {
  const period = resolvePeriod((await params).period);
  const { language } = await serverPublicCopy();
  const text = hebrewCopy[period];
  const canonical = localizedPath(`/weekend/${period}`, language);
  return { title: text.metaTitle, description: text.description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title: text.metaTitle, description: text.description } };
}

export default async function WeekendLandingPage({ params }: { params: Promise<{ period: string }> }) {
  const period = resolvePeriod((await params).period);
  const { translate } = await serverPublicCopy();
  const text = hebrewCopy[period];
  const path = `/weekend/${period}`;
  const faqs = text.faq.map(([question, answer]) => ({ question, answer }));
  return <PageShell variant="vacation" footerTopic="vacation-villas">
    <main id="main-content" className="holiday-world last-minute-world">
      <StructuredData data={breadcrumbSchema([{ name: translate("ראשי"), path: "/" }, { name: text.title, path }])} />
      <StructuredData data={faqSchema(faqs)} />
      <section className="holiday-hero last-minute-hero"><div className="shell holiday-hero__frame">
        <div className="holiday-hero__content"><BreadcrumbTrail items={[{ name: translate("ראשי"), path: "/" }, { name: text.title }]} /><span className="eyebrow">נופש לסוף השבוע הקרוב</span><h1>{text.title}</h1><p>{text.intro}</p><div className="holiday-hero__proof"><span>זמינות לתאריכים המדויקים</span><span>מחיר לכל השהייה</span><span>בדיקה נוספת לפני הזמנה</span></div></div>
        <div className="holiday-hero__media"><img src="/images/last-minute/last-minute-escape.webp" alt="מקום נופש פנוי לסוף השבוע הקרוב" width="1600" height="900" loading="eager" fetchPriority="high" decoding="async" /></div>
      </div></section>
      <HomeLiveDeals fixedPeriod={weekendLandingPeriods[period]} sectionTitle={text.results} allLinkLabel="לכל התוצאות לתאריכים האלה" layout="grid" />
      <section className="section section-tint holiday-faq last-minute-faq"><div className="shell"><div className="holiday-section-head"><h2>שאלות על נופש בסוף השבוע הקרוב</h2></div><div className="holiday-faq__list">{faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></div></section>
    </main>
  </PageShell>;
}
