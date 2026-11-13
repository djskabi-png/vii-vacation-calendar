import { NearbyRouteActivation } from "../components/nearby-route-activation";
import { nearbyPageContent, nearbyPageFaq } from "../lib/nearby-page-content";
import { faqSchema } from "../lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { trails } from "../data/trail-data";
import { TrailsExplorer } from "./trails-explorer";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { SpecialWorldSearch } from "../components/special-world-search";
import { managedTrails } from "../lib/managed-public-content";
import { DiscoveryWorldHero } from "../components/discovery-world-hero";
import { readWorldLandingPresentation } from "../lib/world-landing-presentation";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { SearchAfterResults } from "../components/search-after-results";
import type { WorldDepthTopic } from "../lib/world-depth-topics";
import { headers } from "next/headers";
import { worldDepthCopy } from "../lib/world-depth-copy";
import { serverLocalePath } from "../i18n/server-public-copy";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = await serverLocalePath("/trails");
  const title = "מסלולי טיול בישראל למטייל העצמאי";
  const description = "מסלולי מים, מפלים, חופים, יערות ומדבר עם דרגת קושי, משך, עונה ומידע בטיחותי ממקורות רשמיים.";
  return { title, description, alternates: { canonical }, openGraph: { type: "website", url: canonical, title, description } };
}

export default async function TrailsPage({ topic, nearbyLanding = false }: { topic?: WorldDepthTopic; nearbyLanding?: boolean } = {}) {
  const publishedTrails = await managedTrails(trails);
  const topicItems = topic ? publishedTrails.filter((trail) => {
    const searchable = `${trail.name} ${trail.mainArea} ${trail.region} ${trail.areaTags.join(" ")} ${trail.nature.join(" ")}`;
    return (topic.params.area ? trail.mainArea === topic.params.area : true)
      && (topic.params.nature ? trail.nature.includes(topic.params.nature) : true)
      && (topic.params.difficulty ? trail.difficulty === topic.params.difficulty : true)
      && (topic.params.q ? searchable.includes(topic.params.q) : true);
  }) : publishedTrails;
  const presentation = await readWorldLandingPresentation("trails");
  const topicCopy = nearbyLanding ? nearbyPageContent.trails : topic ? worldDepthCopy(topic.label, (await headers()).get("x-vii-locale"), "trails") : null;
  return <PageShell variant="activities">
    <main id="main-content" className="trails-page">
      <StructuredData data={collectionSchema(topicCopy?.title || "מסלולי טיול בישראל למטייל העצמאי", topicCopy?.description || "מסלולי מים, חופים, יערות ומדבר עם מידע בטיחותי ומקור רשמי.", nearbyLanding ? nearbyPageContent.trails.path : topic ? `/trails/explore/${topic.slug}` : "/trails/", topicItems.map((trail) => ({ name: trail.name, path: `/trails/${trail.slug}/` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "מסלולי טיול", path: "/trails" }, ...(nearbyLanding ? [{name:nearbyPageContent.trails.title,path:nearbyPageContent.trails.path}] : topic ? [{ name: topic.label, path: `/trails/explore/${topic.slug}` }] : [])])} />
      <SpecialWorldSearch active="trails" targetId="trail-search" initialArea={topic?.params.area} description="בחרו אזור, טבע ודרגת קושי" />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מסלולי טיול", path: "/trails" }, ...(nearbyLanding ? [{name:nearbyPageContent.trails.title,path:nearbyPageContent.trails.path}] : topic ? [{ name: topic.label }] : [])]} />
      <DiscoveryWorldHero className="trails-hero" showBreadcrumbs={false} type="trails" presentation={topicCopy ? { ...presentation, ...topicCopy } : presentation} breadcrumbs={[]} count={topicItems.length} countLabel="מסלולים עצמאיים" targetId="trail-search" />
      {nearbyLanding && <NearbyRouteActivation regionalOnly />}
      <section id="trail-search" className="section shell trail-explorer"><TrailsExplorer items={publishedTrails} initialFilters={topic?.params} /></section>
      <section className="trail-trust"><div className="shell"><strong>מידע אחראי לפני שיוצאים</strong><p>התוכן כאן הוא תכנון מערכת של וי פור ויקיישן על בסיס מקורות רשמיים. תנאי שטח, סגירות, מזג אוויר, שעות ותשלום יכולים להשתנות. נכנסים למקור הרשמי ביום הטיול ופועלים לפי השילוט בשטח.</p><Link href="/attractions">גם אטרקציות בתשלום</Link></div></section>
      {nearbyLanding && <><StructuredData data={faqSchema(nearbyPageFaq("trails"))} /><section className="section shell managed-search-faq"><h2>שאלות נפוצות</h2><p>{nearbyPageContent.trails.body}</p>{nearbyPageFaq("trails").map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section></>}
      <SearchAfterResults world="trails" discoveryOnly baseParams={topic?.params} inventory={publishedTrails.map((trail) => ({ location: trail.region, area: trail.mainArea, nature: trail.nature, difficulty: trail.difficulty }))} />
    </main>
  </PageShell>;
}
