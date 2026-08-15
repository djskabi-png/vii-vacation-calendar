import type { DiscoveryItem } from "../data/world-data";
import { getListingOfferings, type EventPlace, type Listing } from "../data/site-data";
import type { MagazineArticle } from "../data/magazine-data";
import type { Trail } from "../data/trail-data";

export const SITE_URL = "https://vii.spaplus.co";
export const SITE_NAME = "וי פור ויקיישן";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function worldBreadcrumb(world: string) {
  if (world === "spa") return { name: "בתי ספא", path: "/spas" };
  if (world === "hourly") return { name: "חדרים לפי שעה", path: "/hourly" };
  if (world === "activities") return { name: "אטרקציות", path: "/attractions" };
  if (world === "providers") return { name: "ספקים", path: "/providers" };
  if (world === "events") return { name: "אירועים", path: "/events" };
  if (world === "corporate") return { name: "אירועי חברה ורווחה", path: "/corporate" };
  return { name: "נופש", path: "/search" };
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [pathname, query] = normalized.split("?", 2);
  const canonicalPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  return `${SITE_URL}${canonicalPath}${query ? `?${query}` : ""}`;
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: "VII",
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/vii-logo.png`,
      width: 160,
      height: 122,
    },
    knowsLanguage: ["he-IL", "en", "ru", "fr"],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    inLanguage: "he-IL",
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?location={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Images are first-class content on place and discovery pages. Keep the
 * metadata tied to the exact page and avoid guessing at details that are not
 * in the verified catalogue. The ordinal is intentionally descriptive rather
 * than a fabricated description of what the camera captured.
 */
export function imageObject(src: string, subject: string, description: string, index = 0) {
  const suffix = index > 0 ? `, תמונה ${index}` : "";
  const name = `${subject}${suffix}`;
  return {
    "@type": "ImageObject",
    contentUrl: absoluteUrl(src),
    url: absoluteUrl(src),
    name,
    caption: name,
    description,
  };
}

function imageObjects(images: string[], subject: string, description: string) {
  return Array.from(new Set(images)).map((src, index) => imageObject(src, subject, description, index + 1));
}

export function collectionSchema(
  name: string,
  description: string,
  path: string,
  items: Array<{ name: string; path: string; image?: string }>,
) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name,
        description,
        url,
        inLanguage: "he-IL",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": `${url}#list` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          url: absoluteUrl(item.path),
          ...(item.image ? { image: absoluteUrl(item.image) } : {}),
        })),
      },
    ],
  };
}

function amenityFeature(features: string[]) {
  return features.map((name) => ({
    "@type": "LocationFeatureSpecification",
    name,
    value: true,
  }));
}

function address(location: string, area: string) {
  return {
    "@type": "PostalAddress",
    addressLocality: location,
    addressRegion: area,
    addressCountry: "IL",
  };
}

export function lodgingSchema(listing: Listing) {
  const url = `${SITE_URL}/business?id=${listing.slug}`;
  const worlds = getListingOfferings(listing).map((offering) => offering.world);
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    ...(worlds.includes("events") ? { additionalType: "https://schema.org/EventVenue" } : {}),
    "@id": `${url}#place`,
    name: listing.name,
    description: listing.description,
    url,
    mainEntityOfPage: url,
    image: imageObjects([listing.image, ...listing.images], listing.name, listing.description),
    address: address(listing.location, listing.area),
    geo: {
      "@type": "GeoCoordinates",
      latitude: listing.lat,
      longitude: listing.lng,
    },
    amenityFeature: amenityFeature(listing.features),
    ...(worlds.includes("events") ? { maximumAttendeeCapacity: getListingOfferings(listing).find((offering) => offering.world === "events")?.maxGuests } : {}),
    containsPlace: {
      "@type": "Accommodation",
      additionalType: listing.scenario === "single" ? "EntirePlace" : "Suite",
      occupancy: { "@type": "QuantitativeValue", value: listing.guests },
      ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
      ...(listing.units ? { numberOfRooms: listing.units } : {}),
    },
    hasMap: `https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}#map=15/${listing.lat}/${listing.lng}`,
    ...(listing.reviewSource === "legacy-verified" && listing.score && listing.reviews ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: listing.score,
        reviewCount: listing.reviews,
        bestRating: 10,
        worstRating: 1,
      },
    } : {}),
    ...(listing.videos?.length ? {
      subjectOf: listing.videos.map((video) => ({
        "@type": "VideoObject",
        name: video.title,
        description: video.note,
        thumbnailUrl: absoluteUrl(video.poster),
        contentUrl: absoluteUrl(video.src),
      })),
    } : {}),
  };
}

export function eventVenueSchema(place: EventPlace) {
  const url = `${SITE_URL}/events/place/${place.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    "@id": `${url}#place`,
    name: place.name,
    description: place.description,
    url,
    image: imageObjects([place.image, ...place.images], place.name, place.description),
    address: address(place.location, place.area),
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    maximumAttendeeCapacity: place.guests,
    amenityFeature: amenityFeature(place.features),
    hasMap: `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`,
  };
}

export function discoverySchema(item: DiscoveryItem) {
  const url = `${SITE_URL}/discover/place/${item.id}`;
  const type = item.world === "spa" ? "DaySpa" : item.world === "hourly" ? "LodgingBusiness" : item.world === "activities" ? "TouristAttraction" : "ProfessionalService";
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#entity`,
    name: item.name,
    description: item.description,
    url,
    ...(item.image ? { image: imageObject(item.image, item.name, item.description) } : {}),
    address: address(item.location, item.area),
    amenityFeature: amenityFeature(item.features),
  };
}

const hebrewMonths: Record<string, string> = {
  "בינואר": "01", "בפברואר": "02", "במרץ": "03", "באפריל": "04",
  "במאי": "05", "ביוני": "06", "ביולי": "07", "באוגוסט": "08",
  "בספטמבר": "09", "באוקטובר": "10", "בנובמבר": "11", "בדצמבר": "12",
};

export function articlePublishedDate(dateLabel: string) {
  const [day, month, year] = dateLabel.split(" ");
  return year && hebrewMonths[month] ? `${year}-${hebrewMonths[month]}-${day.padStart(2, "0")}` : "2026-08-05";
}

export function articleSchema(article: MagazineArticle) {
  const url = `${SITE_URL}/guides/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    image: absoluteUrl(article.image),
    datePublished: articlePublishedDate(article.dateLabel),
    inLanguage: "he-IL",
    mainEntityOfPage: url,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    articleSection: article.category,
    keywords: article.tags.join(", "),
  };
}

export function trailSchema(trail: Trail) {
  const url = `${SITE_URL}/trails/${trail.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: trail.name,
        description: trail.summary,
        inLanguage: "he-IL",
        mainEntityOfPage: url,
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
        about: trail.nature,
        citation: trail.officialSource,
      },
      {
        "@type": "TouristTrip",
        "@id": `${url}#trip`,
        name: trail.name,
        description: trail.summary,
        touristType: trail.familyFit,
        itinerary: {
          "@type": "ItemList",
          itemListElement: trail.dayPlan.map((name, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name,
          })),
        },
        provider: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}
