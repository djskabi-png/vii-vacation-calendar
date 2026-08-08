import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "./structured-data";
import { SearchExperience } from "../search/page";
import { accommodationLandingForPath, type AccommodationCategoryId } from "../data/accommodation-landings";
import { breadcrumbSchema, collectionSchema, faqSchema } from "../lib/seo";

export function accommodationLandingMetadata(categoryId: AccommodationCategoryId, regionSlug?: string | null): Metadata {
  const landing = accommodationLandingForPath(categoryId, regionSlug);
  if (!landing) return { robots: { index: false, follow: true } };
  return {
    title: `${landing.title}, מקומות פעילים להזמנה`,
    description: landing.description,
    alternates: { canonical: landing.path },
    openGraph: {
      type: "website",
      url: landing.path,
      title: landing.title,
      description: landing.description,
      images: landing.listings[0]?.image ? [{ url: landing.listings[0].image, alt: landing.listings[0].name }] : undefined,
    },
  };
}

export function AccommodationLandingRoute({ categoryId, regionSlug }: { categoryId: AccommodationCategoryId; regionSlug?: string | null }) {
  const landing = accommodationLandingForPath(categoryId, regionSlug);
  if (!landing) notFound();

  const breadcrumbs = [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: "/search" },
    ...(landing.region ? [{ name: landing.category.title, path: landing.category.path }] : []),
    { name: landing.title, path: landing.path },
  ];
  const faqs = [
    {
      question: `איך בוחרים ${landing.title}?`,
      answer: "משווים בין מספר חדרי השינה והיחידות, כמות האורחים, המתקנים, התמונות המלאות ואופן ההזמנה בכל מקום.",
    },
    {
      question: `האם כל המקומות בעמוד ${landing.title} פעילים?`,
      answer: "כן. בעמוד מוצגים רק מקומות פעילים שעומדים בדרישות המדיה והתוכן של האתר.",
    },
    {
      question: "איך ממשיכים להזמנה?",
      answer: "נכנסים לעמוד המקום, בוחרים תאריכים והרכב אורחים וממשיכים להזמנה מקוונת או לפנייה ישירה, בהתאם לשיטת העבודה של המקום.",
    },
  ];

  return <>
    <StructuredData data={collectionSchema(
      landing.title,
      landing.description,
      landing.path,
      landing.listings.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })),
    )} />
    <StructuredData data={breadcrumbSchema(breadcrumbs)} />
    <StructuredData data={faqSchema(faqs)} />
    <SearchExperience landing={{
      path: landing.path,
      title: landing.title,
      description: landing.description,
      breadcrumb: landing.title,
      type: landing.category.propertyTypes[0],
      types: landing.category.propertyTypes,
      area: landing.region?.label,
      listingSlugs: landing.listings.map((property) => property.slug),
    }} />
  </>;
}
