import type { DiscoveryItem } from "../data/world-data.ts";
import type { Trail } from "../data/trail-data.ts";
import type { MagazineArticle } from "../data/magazine-data.ts";
import { readPublishedContent, readPublishedContentBatch, readPublishedItems, type ContentLocale, type ContentType } from "./content-studio.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { magazineBodyOverride } from "./magazine-body";

export async function managedDiscoveryItems(items: readonly DiscoveryItem[], type: Extract<ContentType, "providers" | "attractions">) {
  const db = await runtimeCatalogDatabase(); if (!db) return [...items];
  try {
  const overlays = await readPublishedContentBatch(db, type, items.map((item) => item.id));
  const managed = items.map((item) => { const content = overlays.get(item.id); return content ? { ...item, name: content.title,
    description: content.summary, imageLabel: content.imageAlt || item.imageLabel, indexable: content.indexable } : item; });
  const known = new Set(items.map((item) => item.id)); const originals = (await readPublishedItems(db, type)).filter((item) => !known.has(item.key));
  return [...managed, ...originals.map(({ key, content }): DiscoveryItem => ({ id: key, world: type === "providers" ? "providers" : "activities",
    name: content.title, location: content.attributes.location, area: content.attributes.area, description: content.summary,
    features: split(content.attributes.features), image: content.attributes.image, priceLabel: content.attributes.priceLabel || undefined,
    phone: content.attributes.phone || undefined, sourceUrl: content.attributes.sourceUrl || undefined,
    sourceName: content.attributes.sourceName, indexable: content.indexable }))];
  } catch { return [...items]; }
}

export async function managedTrails(items: readonly Trail[]) {
  const db = await runtimeCatalogDatabase(); if (!db) return [...items];
  try {
  const overlays = await readPublishedContentBatch(db, "trails", items.map((item) => item.slug));
  const managed = items.map((item) => { const content = overlays.get(item.slug); return content ? { ...item, name: content.title, summary: content.summary } : item; });
  const known = new Set(items.map((item) => item.slug)); const originals = (await readPublishedItems(db, "trails")).filter((item) => !known.has(item.key));
  return [...managed, ...originals.map(({ key, content }): Trail => ({ slug: key, name: content.title,
    mainArea: content.attributes.mainArea as Trail["mainArea"], region: content.attributes.region, areaTags: [content.attributes.mainArea, content.attributes.region],
    nature: split(content.attributes.nature), distance: content.attributes.distance || "לא צוין", duration: content.attributes.duration,
    difficulty: content.attributes.difficulty as Trail["difficulty"], routeType: content.attributes.routeType || "לא צוין",
    bestSeason: content.attributes.bestSeason || "יש לבדוק במקור הרשמי", familyFit: content.attributes.familyFit || content.summary,
    accessibility: content.attributes.accessibility || "יש לבדוק במקור הרשמי", summary: content.summary,
    highlights: split(content.attributes.nature), dayPlan: paragraphs(content.body), safety: ["בודקים תנאי שטח ועדכונים במקור הרשמי לפני היציאה"],
    officialSource: content.attributes.officialSource, sourceName: content.attributes.sourceName, mapQuery: content.attributes.mapQuery, tone: "forest" }))];
  } catch { return [...items]; }
}

export async function managedMagazineArticles(items: readonly MagazineArticle[]) {
  const db = await runtimeCatalogDatabase(); if (!db) return [...items];
  try {
  const overlays = await readPublishedContentBatch(db, "magazine", items.map((item) => item.slug));
  const managed = items.map((item) => { const content = overlays.get(item.slug); return content ? { ...item, title: content.title,
    excerpt: content.summary, ...magazineBodyOverride(content.body, item), imageAlt: content.imageAlt || item.imageAlt,
    image: content.attributes.image || item.image, imageTitle: content.attributes.imageTitle || item.imageTitle || item.imageAlt,
    imageCredit: content.attributes.imageCredit || item.imageCredit,
    indexable: content.indexable, metaTitle: content.metaTitle || item.title, metaDescription: content.metaDescription || content.summary } : item; });
  const known = new Set(items.map((item) => item.slug)); const originals = (await readPublishedItems(db, "magazine")).filter((item) => !known.has(item.key));
  return [...managed, ...originals.map(({ key, content }): MagazineArticle => ({ slug: key, title: content.title,
    category: content.attributes.category, excerpt: content.summary, image: content.attributes.image, imageAlt: content.imageAlt,
    imageTitle: content.attributes.imageTitle || content.imageAlt, imageCredit: content.attributes.imageCredit,
    indexable: content.indexable, metaTitle: content.metaTitle, metaDescription: content.metaDescription,
    readTime: Math.max(1, Number(content.attributes.readTime) || 5), dateLabel: content.attributes.dateLabel,
    tags: split(content.attributes.tags), intro: content.body, takeaway: content.attributes.takeaway || content.summary,
    sections: [{ id: "article", title: content.title, paragraphs: paragraphs(content.body) }], checklist: ["קראתי ושמרתי את הרעיון להמשך"] }))];
  } catch { return [...items]; }
}

export async function managedChrome(type: "navigation" | "footer", key: string, locale: ContentLocale = "he") {
  const db = await runtimeCatalogDatabase(); if (!db) return null;
  try { return await readPublishedContent(db, type, key, locale); } catch { return null; }
}

function split(value = "") { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function paragraphs(value = "") { const result = value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean); return result.length ? result : ["המידע המלא יעודכן בקרוב."]; }
