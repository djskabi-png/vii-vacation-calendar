import type { Metadata } from "next";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { StructuredData } from "../../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../../lib/seo";

export const metadata: Metadata = {
  title: "מקומות לאירועים פרטיים בישראל",
  description: "מחפשים מקומות לאירועים לפי אזור, סוג אירוע, כמות משתתפים, מתקנים ונגישות מאומתת.",
  alternates: { canonical: "/events/search" },
  openGraph: {
    type: "website",
    url: "/events/search/",
    title: "מקומות לאירועים בישראל",
    description: "משווים מקומות לאירועים לפי קיבולת, אזור, סגנון ומאפיינים.",
  },
};

export default function EventSearchLayout({ children }: { children: React.ReactNode }) {
  return <>
    <StructuredData data={collectionSchema(
      "מקומות לאירועים בישראל",
      "מקומות לאירועים פרטיים להשוואה לפי אזור, קיבולת וסוג אירוע.",
      "/events/search/",
      eventPlaces.map((place) => ({
        name: place.name,
        path: eventPlaceHref(place),
        image: place.image,
      })),
    )} />
    <StructuredData data={breadcrumbSchema([
      { name: "ראשי", path: "/" },
      { name: "אירועים", path: "/events/" },
      { name: "מקומות לאירועים", path: "/events/search/" },
    ])} />
    {children}
  </>;
}
