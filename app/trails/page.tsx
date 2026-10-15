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

export const metadata: Metadata = {
  title: "מסלולי טיול בישראל למטייל העצמאי",
  description: "מסלולי מים, מפלים, חופים, יערות ומדבר עם דרגת קושי, משך, עונה ומידע בטיחותי ממקורות רשמיים.",
  alternates: { canonical: "/trails" },
};

export default async function TrailsPage() {
  const publishedTrails = await managedTrails(trails);
  const presentation = await readWorldLandingPresentation("trails");
  return <PageShell variant="activities">
    <main id="main-content" className="trails-page">
      <StructuredData data={collectionSchema("מסלולי טיול בישראל למטייל העצמאי", "מסלולי מים, חופים, יערות ומדבר עם מידע בטיחותי ומקור רשמי.", "/trails/", publishedTrails.map((trail) => ({ name: trail.name, path: `/trails/${trail.slug}/` })))} />
      <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "מסלולי טיול", path: "/trails" }])} />
      <SpecialWorldSearch active="trails" targetId="trail-search" description="בחרו אזור, טבע ודרגת קושי" />
      <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "מסלולי טיול" }]} />
      <DiscoveryWorldHero className="trails-hero" showBreadcrumbs={false} type="trails" presentation={presentation} breadcrumbs={[]} count={publishedTrails.length} countLabel="מסלולים עצמאיים" targetId="trail-search" />
      <section id="trail-search" className="section shell trail-explorer"><TrailsExplorer items={publishedTrails} /></section>
      <section className="trail-trust"><div className="shell"><strong>מידע אחראי לפני שיוצאים</strong><p>התוכן כאן הוא תכנון מערכת של וי פור ויקיישן על בסיס מקורות רשמיים. תנאי שטח, סגירות, מזג אוויר, שעות ותשלום יכולים להשתנות. נכנסים למקור הרשמי ביום הטיול ופועלים לפי השילוט בשטח.</p><Link href="/attractions">גם אטרקציות בתשלום</Link></div></section>
    </main>
  </PageShell>;
}
