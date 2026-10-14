import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { paidAttractions } from "../data/world-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { AttractionsExplorer } from "./attractions-explorer";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { SearchAfterResults } from "../components/search-after-results";
import { SpecialWorldSearch } from "../components/special-world-search";
import { managedDiscoveryItems } from "../lib/managed-public-content";

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

export default async function AttractionsPage() {
  const attractions = await managedDiscoveryItems(paidAttractions, "attractions");
  return <PageShell variant="activities">
    <main id="main-content" className="attractions-page">
      <StructuredData data={collectionSchema("אטרקציות בתשלום בישראל", "אטרקציות, סיורים וחוויות לפי אזור וסוג פעילות.", "/attractions/", attractions.map((item) => ({ name: item.name, path: `/discover/place/${item.id}` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אטרקציות", path: "/attractions/" }])} />
      <SpecialWorldSearch active="attractions" targetId="attraction-search" description="בחרו אזור וסוג חוויה" />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "אטרקציות" }]} />
      <section className="attractions-hero"><div className="shell"><h1>אטרקציות בישראל</h1><p>בוחרים אזור וסוג פעילות ומוצאים חוויה שמתאימה בדיוק להרכב שלכם.</p></div></section>
      <section id="attraction-search" className="section shell trail-explorer attraction-explorer"><AttractionsExplorer items={attractions} /></section>
      <section className="attraction-trust"><div className="shell"><div><strong>מידע מאומת</strong><span>מוצגים ספק, אזור, תנאים ודרך הזמנה ברורה.</span></div><div><strong>בלי הפתעות בהזמנה</strong><span>המגבלות, הביטוח, מדיניות הביטול ומה כלול מוצגים לפני אישור.</span></div><div><strong>הכל במקום אחד</strong><span>המידע ודרך ההזמנה נשארים בתוך VII, בהתאם לשיטת המכירה של הספק.</span></div><Link href="/trails">מסלולי טיול עצמאיים</Link></div></section>
      <SearchAfterResults world="activities" reviewHighlights={attractions.filter((item) => typeof item.rating === "number").sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3).map((item) => ({ name: item.name, href: `/discover/place/${item.id}`, rating: item.rating || 0, context: item.sourceName ? `דירוג מתוך ${item.sourceName}` : undefined }))} />
    </main>
  </PageShell>;
}
