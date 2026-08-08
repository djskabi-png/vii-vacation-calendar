import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { paidAttractions } from "../data/world-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { AttractionsExplorer } from "./attractions-explorer";

export const metadata: Metadata = {
  title: "אטרקציות בתשלום בישראל לפי אזור וסוג חוויה",
  description: "אטרקציות, סיורים וחוויות בתשלום לפי אזור, הרכב וסוג פעילות, עם התאמת ספק ותהליך הזמנה ברור באתר.",
  alternates: { canonical: "/attractions" },
  openGraph: {
    type: "website",
    url: "/attractions/",
    title: "אטרקציות בישראל",
    description: "בוחרים אזור וסוג פעילות ומוצאים חוויות שמתאימות בדיוק להרכב שלכם.",
  },
};

export default function AttractionsPage() {
  return <PageShell variant="activities">
    <main id="main-content" className="attractions-page">
      <StructuredData data={collectionSchema("אטרקציות בתשלום בישראל", "אטרקציות, סיורים וחוויות לפי אזור וסוג פעילות.", "/attractions/", paidAttractions.map((item) => ({ name: item.name, path: `/discover/place?world=activities&id=${item.id}` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אטרקציות", path: "/attractions/" }])} />
      <nav className="shell breadcrumbs world-breadcrumbs" aria-label="פירורי לחם"><Link href="/">ראשי</Link><span>/</span><span aria-current="page">אטרקציות</span></nav>
      <section className="attractions-hero"><div className="shell attractions-hero__layout"><div><h1>אטרקציות בישראל</h1><p>בוחרים אזור וסוג פעילות ומוצאים חוויה שמתאימה בדיוק להרכב שלכם.</p><div className="trails-hero__actions"><a className="button primary" href="#attraction-search">מציאת אטרקציה</a><Link className="button light" href="/trails">מסלולי טיול עצמאיים</Link></div></div><div className="attractions-hero__panel" aria-label="איך ההזמנה עובדת"><span>תהליך פשוט</span><ol><li><b>1</b><strong>בוחרים חוויה</strong><small>אזור, תאריך והרכב</small></li><li><b>2</b><strong>רואים את כל הפרטים</strong><small>מחיר, תנאים ומה כלול</small></li><li><b>3</b><strong>מזמינים בדרך המתאימה</strong><small>תשלום באתר או חיוג לספק</small></li></ol></div></div></section>
      <section className="attraction-trust"><div className="shell"><div><strong>מידע מאומת</strong><span>מוצגים ספק, אזור, תנאים ודרך הזמנה ברורה.</span></div><div><strong>בלי הפתעות בהזמנה</strong><span>המגבלות, הביטוח, מדיניות הביטול ומה כלול מוצגים לפני אישור.</span></div><div><strong>הכל במקום אחד</strong><span>המידע ודרך ההזמנה נשארים בתוך VII, בהתאם לשיטת המכירה של הספק.</span></div></div></section>
      <section id="attraction-search" className="section shell trail-explorer attraction-explorer"><div className="section-head"><div><h2>אטרקציות בישראל</h2><p>מסננים לפי אזור וסוג פעילות ובוחרים חוויה שמתאימה לכם.</p></div></div><AttractionsExplorer /></section>
    </main>
  </PageShell>;
}
