import type { Metadata } from "next";
import data from "../data/legacy-landing-editorial.generated.json" with { type: "json" };
import vacation from "../data/legacy-search-page-publications.json" with { type: "json" };
import events from "../data/legacy-event-search-pages.json" with { type: "json" };
import { readPublishedContent, sourceEditorial, type ContentSource } from "./content-studio.ts";
import { runtimeDatabase } from "./runtime-database.ts";
import { legacyMetadataFields } from "./legacy-landing-meta-fields.ts";

type Tags = Record<string, string>;
type Faq = { question: string; answer: string };
type Promoted = { previous: string; title: string; metaTitle: string; description: string; body: string; faq: Faq[]; metadata: Tags };
const promoted = data.promoted as Record<string, Promoted>;
const managed = data.managed as Record<string, number[]>;
function managedTags(path: string): Tags {
  return Object.fromEntries((managed[path] || []).flatMap((index, field) => index < 0 ? [] : [[data.fields[field], data.values[index]]]));
}
const keyFor = (path: string) => path.slice(1).replaceAll("/", ".");
const promotedPaths = new Map(Object.entries(promoted).map(([path, page]) => [page.previous, path]));

export function decodeLegacyMetadata(raw: string | undefined): Tags | null {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const tags = Object.entries(value);
    if (tags.some(([key, value]) => !legacyMetadataFields.some(field => field === key) || typeof value !== "string" || value.length > 1500 || /[<>\u0000-\u001f]/.test(value))) return null;
    return Object.fromEntries(tags);
  } catch { return null; }
}

export function legacySocialMetadata(tags: Tags, path: string, title: string, description: string): Pick<Metadata, "keywords" | "openGraph" | "twitter"> {
  const image = (key: string) => {
    const src = tags[key];
    return src && (/^https:\/\//i.test(src) || /^\/(?!\/)/.test(src)) && !/[\\\s]/.test(src) ? src : undefined;
  };
  const ogImage = image("og:image");
  const twitterImage = image("twitter:image");
  const dimension = (key: string) => /^\d{1,5}$/.test(tags[key] ?? "") ? Number(tags[key]) : undefined;
  const card = tags["twitter:card"] === "summary" || tags["twitter:card"] === "summary_large_image" ? tags["twitter:card"] : undefined;
  return {
    keywords: tags.keywords,
    openGraph: { type: tags["og:type"] === "article" ? "article" : "website", url: path, title: tags["og:title"] || title,
      description: tags["og:description"] || description, siteName: tags["og:site_name"],
      images: ogImage ? [{ url: ogImage, type: tags["og:image:type"], width: dimension("og:image:width"), height: dimension("og:image:height"), alt: tags["og:image:alt"] }] : undefined },
    ...(card || tags["twitter:title"] || tags["twitter:description"] || twitterImage ? { twitter: {
      card: card || "summary", title: tags["twitter:title"] || title, description: tags["twitter:description"] || description,
      images: twitterImage ? [{ url: twitterImage, alt: tags["twitter:image:alt"] }] : undefined,
    } } : {}),
  };
}

function faqText(value: string) { return value.replace(/<[^>]*>/g, "").trim(); }

function source(path: string, title: string, metaTitle: string, description: string, body: string, faq: Faq[], tags: Tags): ContentSource {
  return { type: "legacylanding", key: keyFor(path), world: path.startsWith("/search/events/") ? "events" : "vacation", locale: "he",
    sourceLabel: "VII legacy editorial", title, summary: description, body, metaTitle, metaDescription: description, indexable: true,
    attributes: { legacyMetadata: JSON.stringify(tags), legacyFaq: JSON.stringify(faq.map(({ question, answer }) => ({ question, answer: faqText(answer) }))) } };
}

function promotedSource(path: string, page: Promoted) {
  return source(path, page.title, page.metaTitle, page.description, page.body, page.faq, page.metadata);
}

export function legacyLandingSources() {
  const originalSearchPages = [...vacation.pages, ...events].filter(page => Object.hasOwn(managed, page.canonicalPath) && !promotedPaths.has(page.canonicalPath));
  return [
    ...Object.entries(promoted).map(([path, page]) => promotedSource(path, page)),
    ...originalSearchPages.map(page => source(page.canonicalPath, page.h1, page.metaTitle, page.metaDescription, page.body, page.faq, managedTags(page.canonicalPath))),
  ];
}

export function legacyLandingPublicPath(key: string) {
  return /^[-a-z0-9]+(?:\.[-a-z0-9]+)*$/.test(key) ? `/${key.replaceAll(".", "/")}` : "/";
}

export function promotedLegacyTarget(previous: string) { return promotedPaths.get(previous); }

export async function legacyLandingEditorial(path: string, locale: string = "he") {
  if (locale !== "he" || !(Object.hasOwn(promoted, path) || Object.hasOwn(managed, path))) return null;
  const baseline = Object.hasOwn(promoted, path) ? promoted[path] : null;
  const database = await runtimeDatabase().catch(() => undefined);
  const published = database ? (await readPublishedContent(database, "legacylanding", keyFor(path)).catch(() => null))?.content : null;
  return { content: published || (baseline ? sourceEditorial(promotedSource(path, baseline)) : null), tags: published ? decodeLegacyMetadata(published.attributes.legacyMetadata) || {} : baseline?.metadata || managedTags(path) };
}

export function decodeLegacyFaq(raw: string | undefined): Faq[] | null {
  if (!raw) return [];
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 24 || rows.some(row => !row || typeof row.question !== "string" || typeof row.answer !== "string" || row.question.length > 240 || row.answer.length > 1600 || /[<>]/.test(row.question + row.answer))) return null;
    return rows.filter(row => row.question.trim() && row.answer.trim());
  } catch { return null; }
}
