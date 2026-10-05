import type { Metadata } from "next";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "מקומות נופש בישראל",
  description: "מקומות נופש עם תמונות, יחידות ומתקנים. התאמה להרכב האורחים נבדקת מול המקום.",
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
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "נופש", path: "/search/" },
    ])} />
    {children}
  </>;
}
