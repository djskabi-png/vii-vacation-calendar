import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { paidAttractions } from "../data/world-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { AttractionsExplorer } from "./attractions-explorer";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { SearchAfterResults } from "../components/search-after-results";

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
      <StructuredData data={collectionSchema("אטרקציות בתשלום בישראל", "אטרקציות, סיורים וחוויות לפי אזור וסוג פעילות.", "/attractions/", paidAttractions.map((item) => ({ name: item.name, path: `/discover/place/${item.id}` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אטרקציות", path: "/attractions/" }])} />
      <section className="special-search-rail"><div className="shell"><a className="special-search-summary" href="#attraction-search"><span><strong>כל הארץ</strong><small>בחרו אזור וסוג חוויה</small></span><b>שינוי חיפוש</b></a></div></section>
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "אטרקציות" }]} />
      <section className="attractions-hero"><div className="shell"><h1>אטרקציות בישראל</h1><p>בוחרים אזור וסוג פעילות ומוצאים חוויה שמתאימה בדיוק להרכב שלכם.</p></div></section>
      <section id="attraction-search" className="section shell trail-explorer attraction-explorer"><AttractionsExplorer /></section>
      <section className="attraction-trust"><div className="shell"><div><strong>מידע מאומת</strong><span>מוצגים ספק, אזור, תנאים ודרך הזמנה ברורה.</span></div><div><strong>בלי הפתעות בהזמנה</strong><span>המגבלות, הביטוח, מדיניות הביטול ומה כלול מוצגים לפני אישור.</span></div><div><strong>הכל במקום אחד</strong><span>המידע ודרך ההזמנה נשארים בתוך VII, בהתאם לשיטת המכירה של הספק.</span></div><Link href="/trails">מסלולי טיול עצמאיים</Link></div></section>
      <SearchAfterResults world="activities" reviewHighlights={paidAttractions.filter((item) => typeof item.rating === "number").sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3).map((item) => ({ name: item.name, href: `/discover/place/${item.id}`, rating: item.rating || 0, context: item.sourceName ? `דירוג מתוך ${item.sourceName}` : undefined }))} />
    </main>
  </PageShell>;
}
