import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StructuredData } from "./structured-data";
import { SearchExperience } from "../search/page";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { PublishedCatalogSeed } from "../lib/published-catalog-seed";
import type { Property } from "../data/site-data";
import { publicVacationSearchProperties } from "../lib/public-vacation-search";
import { accommodationLandingForPath, indexableAccommodationLandings, type AccommodationCategoryId } from "../data/accommodation-landings";
import { breadcrumbSchema, collectionSchema, faqSchema } from "../lib/seo";
import { canonicalLegacyVacationSearchPath, semanticVacationFeaturesFromSearchParams, vacationSearchHasTransactionalState } from "../lib/legacy-search-intent.ts";

export type AccommodationSearchParams = Promise<Record<string, string | string[] | undefined>>;

function urlSearchParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

export async function accommodationLandingMetadata(categoryId: AccommodationCategoryId, regionSlug?: string | null): Promise<Metadata> {
  const publishedProperties = publicVacationSearchProperties(await publicCatalogSummaries<Property>("vacations"));
  const landing = accommodationLandingForPath(categoryId, regionSlug, publishedProperties);
  if (!landing) return { robots: { index: false, follow: true } };
  return {
    title: `${landing.title} | ${landing.listings.length === 1 ? landing.category.countOne : `${landing.listings.length} מקומות`}`,
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

export async function AccommodationLandingRoute({ categoryId, regionSlug, searchParams }: { categoryId: AccommodationCategoryId; regionSlug?: string | null; searchParams?: AccommodationSearchParams }) {
  const publishedProperties = await publicCatalogSummaries<Property>("vacations");
  const landing = accommodationLandingForPath(categoryId, regionSlug, publishedProperties);
  if (!landing) notFound();
  if (searchParams) {
    const params = urlSearchParams(await searchParams);
    const canonical = !vacationSearchHasTransactionalState(params)
      ? canonicalLegacyVacationSearchPath({ location: landing.region?.label || "כל הארץ", type: landing.category.propertyTypes[0], features: semanticVacationFeaturesFromSearchParams(params) })
      : null;
    if (canonical) {
      const locale = (await headers()).get("x-vii-locale");
      redirect(`${locale && locale !== "he" ? `/${locale}` : ""}${canonical}`);
    }
  }
  if (!landing.listings.length) {
    const locale = (await headers()).get("x-vii-locale");
    const prefix = locale && locale !== "he" ? `/${locale}` : "";
    redirect(landing.region ? `${prefix}/search?location=${encodeURIComponent(landing.region.label)}` : `${prefix}/search`);
  }

  const breadcrumbs = [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: "/search" },
    ...(landing.region ? [{ name: landing.category.title, path: landing.category.path }] : []),
    { name: landing.title, path: landing.path },
  ];
  const featureCounts = new Map<string, number>();
  for (const property of landing.listings) {
    for (const feature of [...new Set(property.features)].slice(0, 20)) {
      if (feature.length < 3 || feature.length > 45) continue;
      featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
    }
  }
  const commonFeatures = [...featureCounts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "he"))
    .slice(0, 3)
    .map(([feature]) => feature);
  const onlineBookingCount = landing.listings.filter((property) => property.onlineAvailability && property.onlinePrices).length;
  const maximumGuests = Math.max(0, ...landing.listings.map((property) => property.guests || 0));
  const localPlaces = [...new Set(landing.listings.map((property) => property.location).filter(Boolean))].slice(0, 6);
  const countText = landing.listings.length === 1 ? landing.category.countOne : `${landing.listings.length} מקומות אירוח`;
  const featureText = commonFeatures.length ? commonFeatures.join(", ") : "פרטי היחידות והמתקנים משתנים ממקום למקום";
  const faqs = [
    {
      question: `כמה אפשרויות של ${landing.title} מופיעות בעמוד?`,
      answer: `בעמוד מופיעים כעת ${countText} מהמלאי הפעיל. הרשימה מתעדכנת כאשר מקום נוסף נכנס לקטגוריה או מפסיק להיות פעיל.`,
    },
    {
      question: `אילו מתקנים אפשר למצוא אצל ${landing.title}?`,
      answer: `בין הפרטים שחוזרים במקומות שבעמוד: ${featureText}. את הרשימה המדויקת בודקים בעמוד של כל מקום, משום שהמתקנים אינם זהים בכל המתחמים.`,
    },
    {
      question: `האם אפשר להזמין ${landing.title} אונליין?`,
      answer: onlineBookingCount
        ? `${onlineBookingCount} מהמקומות בעמוד מנהלים גם זמינות וגם מחיר אונליין. במקומות האחרים ממשיכים לטלפון או לוואטסאפ כדי לאשר זמינות ומחיר.`
        : "במקומות שבעמוד ממשיכים לפנייה ישירה כדי לאשר זמינות ומחיר. האתר אינו מציג אפשרות להזמנה אונליין כאשר אין גם יומן זמינות וגם מחיר.",
    },
    {
      question: `מה כדאי לבדוק לפני שבוחרים ${landing.category.singular}?`,
      answer: `בודקים את מספר חדרי השינה והיחידות, הקיבולת, התמונות, המתקנים ומדיניות המקום. ${maximumGuests ? `הקיבולת הגבוהה ביותר שמופיעה כרגע בעמוד היא עד ${maximumGuests} אורחים ביחידה הגדולה.` : "הקיבולת המדויקת מופיעה בעמוד של כל מקום."}`,
    },
  ];
  const subject = landing.region ? `${landing.category.title} באזור ${landing.region.label}` : landing.category.title;
  const guideTitle = `איך בוחרים ${landing.title}`;
  const guideParagraphs = [
    `בעמוד מרוכזים ${countText} שמתאימים לחיפוש ${subject}. ${localPlaces.length > 1 ? `המלאי משתרע בין ${localPlaces.join(", ")}.` : localPlaces[0] ? `כל התוצאות בעמוד נמצאות ב${localPlaces[0]}.` : "המיקום המדויק מוצג בכל כרטיס."}`,
    `כדי לצמצם את הבחירה מתחילים בהרכב האורחים ובמספר חדרי השינה, ואז משווים תמונות, סידורי לינה ומתקנים. בין הפרטים הבולטים במלאי הנוכחי: ${featureText}. הנתונים המדויקים נשארים בעמוד של כל מקום ולא מוכללים אוטומטית לכל הקטגוריה.`,
    onlineBookingCount
      ? `${onlineBookingCount} מהמקומות בעמוד מאפשרים בדיקת מחיר וזמינות אונליין. בשאר המקומות הזמינות נבדקת בטלפון או בוואטסאפ, ולכן לא מוצג אישור אוטומטי שאין לו מקור.`
      : "המקומות בעמוד אינם מציגים כרגע גם מחיר וגם זמינות אונליין. ממשיכים לעמוד המקום ומשם לטלפון או לוואטסאפ לקבלת תשובה מדויקת.",
  ];
  const relatedLinks = indexableAccommodationLandings(publishedProperties)
    .filter((candidate) => candidate.path !== landing.path)
    .map((candidate) => accommodationLandingForPath(candidate.category.id, candidate.region?.slug, publishedProperties))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => {
      const sameDestinationLeft = Number(Boolean(landing.region && left.region?.slug === landing.region.slug));
      const sameDestinationRight = Number(Boolean(landing.region && right.region?.slug === landing.region.slug));
      const sameCategoryLeft = Number(left.category.id === landing.category.id);
      const sameCategoryRight = Number(right.category.id === landing.category.id);
      return sameDestinationRight - sameDestinationLeft || sameCategoryRight - sameCategoryLeft || right.listings.length - left.listings.length;
    })
    .slice(0, 10)
    .map((candidate) => ({ label: candidate.title, href: candidate.path }));
  const initialListings = landing.listings.slice(0, 60);

  return <>
    <StructuredData data={collectionSchema(
      landing.title,
      landing.description,
      landing.path,
      initialListings.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })),
    )} />
    <StructuredData data={breadcrumbSchema(breadcrumbs)} />
    <StructuredData data={faqSchema(faqs)} />
    <PublishedCatalogSeed world="vacations" entries={initialListings} complete={false}><SearchExperience landing={{
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
      relatedLinks,
    }} /></PublishedCatalogSeed>
  </>;
}
