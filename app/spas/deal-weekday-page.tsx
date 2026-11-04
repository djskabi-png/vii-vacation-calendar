import { weekdayCopy } from "../i18n/spa-weekday-copy";
import type { Metadata } from "next";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { PageShell } from "../components/page-shell";
import { SpaPackageDeals } from "../components/spa-package-deals";
import { StructuredData } from "../components/structured-data";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { localizedPath, type SiteLanguage } from "../i18n/locale-routing";
import { breadcrumbSchema, faqSchema } from "../lib/seo";
import { spaWeekdayPath, type SpaWeekdaySlug } from "../lib/spa-weekday-pages";
import "../holidays/holiday-world.css";
import "../last-minute/last-minute.css";
import "../events/deal-landing.css";



export function spaWeekdayMetadata(weekday: SpaWeekdaySlug, language: SiteLanguage = "he"): Metadata {
  const text = weekdayCopy(weekday, language);
  const canonical = localizedPath(spaWeekdayPath(weekday), language);
  return { title: text.title, description: text.description, alternates: { canonical },
    openGraph: { type: "website", url: canonical, title: text.title, description: text.description } };
}

export async function SpaWeekdayPage({ weekday }: { weekday: SpaWeekdaySlug }) {
  const { language, translate } = await serverPublicCopy();
  const text = weekdayCopy(weekday, language);
  const canonical = spaWeekdayPath(weekday);
  return <PageShell variant="spa"><main id="main-content" className="holiday-world last-minute-world deal-landing deal-landing--spa">
    <StructuredData data={breadcrumbSchema([{ name: translate("ראשי"), path: "/" }, { name: translate("בתי ספא"), path: "/spas" }, { name: text.title, path: canonical }])} />
    <StructuredData data={faqSchema(text.faq)} />
    <section className="holiday-hero last-minute-hero"><div className="shell holiday-hero__content">
      <BreadcrumbTrail items={[{ name: translate("ראשי"), path: "/" }, { name: translate("בתי ספא"), path: "/spas" }, { name: text.title }]} />
      <span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.description}</p>
    </div></section>
    <SpaPackageDeals sectionId={`spa-weekday-${weekday}`} fixedWeekday={weekday} sectionTitle={text.results} layout="grid" />
    <section className="section section-tint holiday-faq last-minute-faq"><div className="shell"><h2>{text.faqTitle}</h2>
      <div className="holiday-faq__list">{text.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
    </div></section>
  </main></PageShell>;
}
