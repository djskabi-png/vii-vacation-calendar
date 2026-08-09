import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { MasuExperience } from "../components/masu-experience";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema } from "../lib/seo";
import { GiftCardBuilder } from "./gift-card-builder";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";

export const metadata: Metadata = {
  title: "גיפט קארד לחופשה, ספא וחוויות",
  description: "גיפט קארד אחד לבחירת נופש, ספא, אירועים, אטרקציות ושירותים מתוך העולמות של וי.",
  alternates: { canonical: "/gift-card/" },
};

const worlds = [
  ["נופש", "וילות, צימרים וסוויטות"],
  ["ספא ורוגע", "חבילות ספא וטיפולים"],
  ["אירועים", "מקומות ושירותים לחגיגה"],
  ["מסלולי טיול", "מסלולים עצמאיים וחוויות טבע"],
  ["אטרקציות", "פעילויות וחוויות ברחבי הארץ"],
  ["מאסו", "עיסוי וטיפולי פנים עד הבית"],
  ["לבחירה", "המקבל או המקבלת מחליטים"],
];

export default function GiftCardPage() {
  return <PageShell>
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "גיפט קארד", path: "/gift-card/" }])} />
    <main id="main-content" className="gift-page">
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "גיפט קארד" }]} />
      <section className="gift-hero"><div className="shell"><div><span className="eyebrow">מתנה שלא מגבילה את החוויה</span><h1>גיפט קארד אחד.<br />עולם שלם של אפשרויות.</h1><p>נותנים סכום, והם בוחרים איך ליהנות ממנו: נופש, ספא, אירוע, אטרקציה או שירות שמגיע עד המקום.</p><a className="button primary" href="#gift-builder">בוחרים מתנה</a></div><div className="gift-hero__card"><span>VII GIFT CARD</span><b>החופש לבחור</b><small>נופש · ספא · אירועים · חוויות</small></div></div></section>

      <section className="section shell gift-worlds" aria-labelledby="gift-worlds-title"><div className="section-head"><div><span className="eyebrow">מתנה שמתאימה לכולם</span><h2 id="gift-worlds-title">לא צריך לנחש מה הם אוהבים</h2><p>הגיפט קארד משאיר את הבחירה אצל מי שמקבל אותו.</p></div></div><div>{worlds.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="section section-tint" id="gift-builder"><div className="shell"><div className="section-head"><div><span className="eyebrow">יוצרים את המתנה</span><h2>שלושה צעדים וגמרנו</h2><p>בוחרים סכום, מוסיפים שם וברכה, ומשאירים פרטים להשלמת התשלום וההנפקה.</p></div></div><GiftCardBuilder /></div></section>

      <div className="section shell"><MasuExperience context="gift" /></div>

      <section className="section gift-corporate"><div className="shell"><div><span className="eyebrow">מתנות לעובדים וללקוחות</span><h2>גיפט קארד מרוכז לחברות ומועדוני צרכנות</h2><p>חלוקה בכמויות, סכומים שונים, ברכה ארגונית וריכוז בקשה אחת מול הצוות.</p></div><Link className="button light" href="/corporate#corporate-contact">לבקשת הצעה ארגונית</Link></div></section>

      <section className="section shell depth-faq"><div className="section-head"><div><span className="eyebrow">לפני שקונים</span><h2>שאלות נפוצות</h2></div></div><details><summary>איפה אפשר לממש את הגיפט קארד?</summary><p>בעסקים ובחוויות המשתתפים בתוכנית וי. הרשימה והתנאים יוצגו לפני השלמת התשלום.</p></details><details><summary>אפשר לבחור סכום אחר?</summary><p>כן. אפשר לבחור סכום מותאם החל מ-100 ₪.</p></details><details><summary>אפשר לרכוש לכמה עובדים?</summary><p>כן. הזמנה ארגונית עוברת למסלול מרוכז שמאפשר לבחור סכומים, כמויות וברכה אחידה או אישית.</p></details></section>
    </main>
  </PageShell>;
}
