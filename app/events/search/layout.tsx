import type { Metadata } from "next";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema } from "../../lib/seo";

export const metadata: Metadata = {
  title: "מקומות לאירועים פרטיים בישראל",
  description: "מקומות לאירועים עם תמונות ומתקנים. התאמה לכמות המשתתפים נבדקת מול המקום.",
  alternates: { canonical: "/events/search" },
  openGraph: {
    type: "website",
    url: "/events/search/",
    title: "מקומות לאירועים בישראל",
    description: "מקומות לאירועים עם תמונות ומתקנים. התאמה לכמות המשתתפים נבדקת מול המקום.",
  },
};

export default function EventSearchLayout({ children }: { children: React.ReactNode }) {
  return <>
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: "מקומות לאירועים", path: "/events/search/" },
    ])} />
    {children}
  </>;
}
