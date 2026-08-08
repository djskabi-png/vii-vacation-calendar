import type { Metadata } from "next";
import { properties } from "../data/site-data";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "נופש בישראל, וילות, סוויטות ומתחמי אירוח",
  description: "מחפשים ומשווים מקומות נופש בישראל לפי אזור, סוג מקום, מספר אורחים, בריכה, ספא, פרטיות ונגישות מאומתת.",
  alternates: { canonical: "/search" },
  openGraph: {
    type: "website",
    url: "/search/",
    title: "מקומות נופש בישראל",
    description: "מקומות נופש עם מידע על חדרים, יחידות, מתקנים והתאמה להרכב האורחים.",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>
    <StructuredData data={collectionSchema(
      "מקומות נופש בישראל",
      "מקומות נופש להשוואה לפי אזור, סוג מקום, הרכב ומאפיינים.",
      "/search/",
      properties.map((property) => ({
        name: property.name,
        path: `/business?id=${property.slug}`,
        image: property.image,
      })),
    )} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "נופש", path: "/search/" },
    ])} />
    {children}
  </>;
}
