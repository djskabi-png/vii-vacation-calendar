/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { PageShell } from "../components/page-shell";
import { StructuredData } from "../components/structured-data";
import { destinations } from "../data/site-data";
import { cleanVacationPath } from "../data/vacation-landings";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "יעדי נופש בישראל",
  description: "מכירים אזורי נופש בישראל וממשיכים לחיפוש ממוקד לפי היעד שמתאים לכם.",
  alternates: { canonical: "/destinations" },
};

const destinationPath = (name: string) => cleanVacationPath(name) || `/search?location=${encodeURIComponent(name)}`;

export default function DestinationsPage() {
  return <PageShell><main id="main-content">
    <StructuredData data={collectionSchema("יעדי נופש בישראל", "אזורי נופש בישראל וחיפוש ממוקד לפי יעד.", "/destinations", destinations.map((item) => ({ name: item.name, path: destinationPath(item.name), image: item.image })))} />
    <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: "יעדי נופש", path: "/destinations" }])} />
    <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: "יעדי נופש" }]} />
    <section className="inner-hero shell"><span className="eyebrow">ישראל מחכה לכם</span><h1>מוצאים את האזור שמתאים לחופשה</h1><p>מהצפון הירוק ועד אילת, הכירו את האופי של כל אזור והמשיכו לחיפוש ממוקד.</p></section>
    <section className="section shell destination-directory">{destinations.map((item, index) => <article key={item.name}><img src={item.image} alt={item.name} title={item.name} /><div><span>0{index + 1}</span><h2>{item.name}</h2><p>{item.subtitle}</p><Link className="button secondary" href={destinationPath(item.name)}>למקומות באזור</Link></div></article>)}</section>
    <section className="section section-tint"><div className="shell region-links"><h2>עוד אזורים לחיפוש</h2><div>{["רמת הגולן", "גליל עליון", "עמקים", "מישור החוף", "השרון", "הרי ירושלים", "נגב", "ערבה"].map((area) => <Link key={area} href={destinationPath(area)}>{area}</Link>)}</div></div></section>
  </main></PageShell>;
}
