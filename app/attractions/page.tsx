import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { paidAttractions } from "../data/world-data";
import { collectionSchema } from "../lib/seo";
import { AttractionsExplorer } from "./attractions-explorer";

export const metadata: Metadata = {
  title: "אטרקציות בתשלום בישראל לפי אזור וסוג חוויה",
  description: "אטרקציות, סיורים וחוויות בתשלום לפי אזור, הרכב וסוג פעילות, עם התאמת ספק ותהליך הזמנה ברור באתר.",
  alternates: { canonical: "/attractions" },
};

export default function AttractionsPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="attractions-page">
      <StructuredData data={collectionSchema("אטרקציות בתשלום בישראל", "אטרקציות, סיורים וחוויות לפי אזור וסוג פעילות.", "/attractions/", paidAttractions.map((item) => ({ name: item.name, path: `/discover/place?world=activities&id=${item.id}` })))} />
      <section className="attractions-hero"><div className="shell attractions-hero__layout"><div><span className="eyebrow">אטרקציות בתשלום</span><h1>בוחרים חוויה. אנחנו דואגים לכל השאר.</h1><p>שטח, מים, אוכל, רכיבה וסדנאות. בוחרים אזור והרכב, ורואים רק אפשרויות שמתאימות לבקשה. שם הספק, המחיר, הזמינות והתנאים מופיעים לפני שמאשרים.</p><div className="trails-hero__actions"><a className="button primary" href="#attraction-search">מציאת אטרקציה</a><Link className="button light" href="/trails">מעדיפים מסלול עצמאי?</Link></div></div><div className="attractions-hero__panel" aria-label="איך ההזמנה עובדת"><span>תהליך פשוט</span><ol><li><b>1</b><strong>בוחרים חוויה</strong><small>אזור, תאריך והרכב</small></li><li><b>2</b><strong>רואים ספק מאומת</strong><small>מחיר, תנאים ומה כלול</small></li><li><b>3</b><strong>מזמינים בדרך הנכונה</strong><small>תשלום באתר או חיוג לספק</small></li></ol></div></div></section>
      <section className="attraction-trust"><div className="shell"><div><strong>בלי עסקים מומצאים</strong><span>אפשרות שלא חוברה עדיין לספק מאומת מוצגת כסוג חוויה, לא כעסק.</span></div><div><strong>בלי הפתעות בהזמנה</strong><span>המגבלות, הביטוח, מדיניות הביטול ומה כלול מוצגים לפני אישור.</span></div><div><strong>הכל נשאר באתר</strong><span>תהליך ההזמנה והמידע נשארים בתוך VII, בהתאם לשיטת המכירה של הספק.</span></div></div></section>
      <section id="attraction-search" className="section shell trail-explorer attraction-explorer"><div className="section-head"><div><span className="eyebrow">מתחילים מהחוויה שמתאימה לכם</span><h2>מה תרצו לעשות היום?</h2><p>אפשר לסנן לפי אזור וסוג פעילות. בשלב החיבור לאתר החי כל כרטיס יקבל ספק, מלאי ומחיר בזמן אמת.</p></div></div><AttractionsExplorer /></section>
    </main>
  </PageShell>;
}
