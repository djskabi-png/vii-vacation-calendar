import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { paidAttractions } from "../data/world-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { AttractionsExplorer } from "./attractions-explorer";
import { SearchAfterResults } from "../components/search-after-results";
import { SpecialWorldSearch } from "../components/special-world-search";
import { managedDiscoveryItems } from "../lib/managed-public-content";
import { DiscoveryWorldHero } from "../components/discovery-world-hero";
import { readWorldLandingPresentation } from "../lib/world-landing-presentation";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import type { WorldDepthTopic } from "../lib/world-depth-topics";
import { activityRegion, activityType } from "../lib/activity-discovery-taxonomy";
import { headers } from "next/headers";
import { worldDepthCopy } from "../lib/world-depth-copy";

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

export default async function AttractionsPage({ topic }: { topic?: WorldDepthTopic } = {}) {
  const attractions = await managedDiscoveryItems(paidAttractions, "attractions");
  const topicItems = topic ? attractions.filter((item) => (!topic.params.area || activityRegion(item) === topic.params.area) && (!topic.params.type || activityType(item) === topic.params.type)) : attractions;
  const presentation = await readWorldLandingPresentation("attractions");
  const topicCopy = topic ? worldDepthCopy(topic.label, (await headers()).get("x-vii-locale"), "activities") : null;
  return <PageShell variant="activities">
    <main id="main-content" className="attractions-page">
      <StructuredData data={collectionSchema(topicCopy?.title || "אטרקציות בתשלום בישראל", topicCopy?.description || "אטרקציות, סיורים וחוויות לפי אזור וסוג פעילות.", topic ? `/attractions/explore/${topic.slug}` : "/attractions/", topicItems.map((item) => ({ name: item.name, path: `/discover/place/${item.id}` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אטרקציות", path: "/attractions/" }, ...(topic ? [{ name: topic.label, path: `/attractions/explore/${topic.slug}` }] : [])])} />
      <SpecialWorldSearch active="attractions" targetId="attraction-search" description="בחרו אזור וסוג חוויה" />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "אטרקציות", path: "/attractions" }, ...(topic ? [{ name: topic.label }] : [])]} />
      <DiscoveryWorldHero className="attractions-hero" showBreadcrumbs={false} type="attractions" presentation={topicCopy ? { ...presentation, ...topicCopy } : presentation} breadcrumbs={[]} count={topicItems.length} countLabel="חוויות לבחירה" targetId="attraction-search" />
      <section id="attraction-search" className="section shell trail-explorer attraction-explorer"><AttractionsExplorer items={attractions} initialArea={topic?.params.area} initialType={topic?.params.type} /></section>
      <section className="attraction-trust"><div className="shell"><div><strong>מידע מאומת</strong><span>מוצגים ספק, אזור, תנאים ודרך הזמנה ברורה.</span></div><div><strong>בלי הפתעות בהזמנה</strong><span>המגבלות, הביטוח, מדיניות הביטול ומה כלול מוצגים לפני אישור.</span></div><div><strong>הכל במקום אחד</strong><span>המידע ודרך ההזמנה נשארים בתוך VII, בהתאם לשיטת המכירה של הספק.</span></div><Link href="/trails">מסלולי טיול עצמאיים</Link></div></section>
      <SearchAfterResults world="activities" baseParams={topic?.params} inventory={attractions.map((item) => ({ location: item.location, area: activityRegion(item) || "", type: activityType(item) || undefined }))} reviewHighlights={topicItems.filter((item) => typeof item.rating === "number").sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3).map((item) => ({ name: item.name, href: `/discover/place/${item.id}`, rating: item.rating || 0, context: item.sourceName ? `דירוג מתוך ${item.sourceName}` : undefined }))} />
    </main>
  </PageShell>;
}
