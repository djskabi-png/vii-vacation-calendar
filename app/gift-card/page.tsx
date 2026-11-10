import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { MasuExperience } from "../components/masu-experience";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema } from "../lib/seo";
import { GiftCardBuilder } from "./gift-card-builder";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { serverLocalePath, serverPublicCopy } from "../i18n/server-public-copy";
import { CurrencyText } from "../components/currency-text";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = await serverLocalePath("/gift-card");
  const { translate } = await serverPublicCopy();
  const title = translate("גיפט קארד לחופשה, ספא וחוויות");
  const description = translate("גיפט קארד אחד לבחירת נופש, ספא, אירועים, אטרקציות ושירותים מתוך העולמות של וי.");
  return { title, description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description } };
}

const worlds = [
  ["נופש", "וילות, צימרים וסוויטות"],
  ["ספא ורוגע", "חבילות ספא וטיפולים"],
  ["אירועים", "מקומות ושירותים לחגיגה"],
  ["מסלולי טיול", "מסלולים עצמאיים וחוויות טבע"],
  ["אטרקציות", "פעילויות וחוויות ברחבי הארץ"],
  ["מאסו", "עיסוי וטיפולי פנים עד הבית"],
  ["לבחירה", "המקבל או המקבלת מחליטים"],
];

export default async function GiftCardPage() {
  const { translate } = await serverPublicCopy();
  return <PageShell>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "גיפט קארד", path: "/gift-card" }])} />
    <main id="main-content" className="gift-page">
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "גיפט קארד" }]} />
      <section className="gift-hero"><div className="shell"><div><h1>{translate("גיפט קארד אחד.")}<br />{translate("עולם שלם של אפשרויות.")}</h1><p>{translate("נותנים סכום, והם בוחרים איך ליהנות ממנו: נופש, ספא, אירוע, אטרקציה או שירות שמגיע עד המקום.")}</p><a className="button primary" href="#gift-builder">{translate("בוחרים מתנה")}</a></div><div className="gift-hero__card"><span>V GIFT CARD</span><b>{translate("החופש לבחור")}</b><small>{translate("נופש · ספא · אירועים · חוויות")}</small></div></div></section>

      <section className="section section-tint" id="gift-builder"><div className="shell"><div className="section-head"><div><h2>{translate("שלושה צעדים וגמרנו")}</h2><p>{translate("בוחרים סכום, מוסיפים שם וברכה, ומשאירים פרטים להשלמת התשלום וההנפקה.")}</p></div></div><GiftCardBuilder /></div></section>

      <section className="section shell gift-worlds" aria-labelledby="gift-worlds-title"><div className="section-head"><div><h2 id="gift-worlds-title">{translate("הם בוחרים את החוויה")}</h2><p>{translate("שובר אחד, לכל העולמות המשתתפים באתר.")}</p></div></div><div>{worlds.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{translate(title)}</h3><p>{translate(description)}</p></article>)}</div></section>

      <div className="section shell"><MasuExperience context="gift" /></div>

      <section className="section gift-corporate"><div className="shell"><div><h2>{translate("גיפט קארד מרוכז לחברות ומועדוני צרכנות")}</h2><p>{translate("חלוקה בכמויות, סכומים שונים, ברכה ארגונית וריכוז בקשה אחת מול הצוות.")}</p></div><Link className="button light" href="/corporate#corporate-contact">{translate("לבקשת הצעה ארגונית")}</Link></div></section>

      <section className="section shell depth-faq"><div className="section-head"><div><h2>{translate("שאלות נפוצות")}</h2></div></div><details><summary>{translate("איפה אפשר לממש את הגיפט קארד?")}</summary><p>{translate("בעסקים ובחוויות המשתתפים בתוכנית וי. הרשימה והתנאים יוצגו לפני השלמת התשלום.")}</p></details><details><summary>{translate("אפשר לבחור סכום אחר?")}</summary><p><CurrencyText text={translate("כן. אפשר לבחור סכום מותאם החל מ-₪ 100.")} /></p></details><details><summary>{translate("אפשר לרכוש לכמה עובדים?")}</summary><p>{translate("כן. הזמנה ארגונית עוברת למסלול מרוכז שמאפשר לבחור סכומים, כמויות וברכה אחידה או אישית.")}</p></details></section>
    </main>
  </PageShell>;
}
