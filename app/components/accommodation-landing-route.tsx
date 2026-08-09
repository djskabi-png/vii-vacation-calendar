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
    robots: landing.listings.length ? undefined : { index: false, follow: true },
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
  const subject = landing.region ? `${landing.category.title} באזור ${landing.region.label}` : landing.category.title;
  const guideTitle = `איך בוחרים ${landing.title}`;
  const guideParagraphs = [
    `מקומות האירוח בקטגוריית ${subject} מתאימים לחופשות מסוגים שונים, ולכן כדאי להתחיל בהרכב האורחים ובמספר חדרי השינה והיחידות הדרושים. לאחר מכן משווים בין המתקנים, רמת הפרטיות, המרחבים המשותפים והמיקום המדויק.`,
    `בעמוד הזה מוצגים רק מקומות פעילים ששייכים לקטגוריית ${landing.category.title}${landing.region ? ` באזור ${landing.region.label}` : " בישראל"}. בכל כרטיס אפשר להיכנס לעמוד המקום ולבדוק תמונות, סידורי לינה, קיבולת, מתקנים ואופן ההזמנה.`,
    "לפני שממשיכים להזמנה בודקים שהתאריכים, המחיר והרכב האורחים מופיעים יחד. כאשר אין מחיר או תאריך מחובר, ממשיכים לשיחה עם המקום כדי לקבל אישור מדויק ולא להסתמך על מידע חלקי.",
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
      resultNoun: landing.category.title,
      resultNounOne: landing.category.countOne,
      area: landing.region?.label,
      listingSlugs: landing.listings.map((property) => property.slug),
      guideTitle,
      guideParagraphs,
      faqs,
    }} />
  </>;
}
