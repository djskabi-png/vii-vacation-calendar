import { spaViiCopy } from "../data/spa-vii-copy.ts";
import spaCatalog from "../data/spaplus-catalog.json" with { type: "json" };
import type { SpaPlusSite } from "../data/spaplus";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";

function text(value: unknown) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Narrative, hours and package terms are reviewed together; prices and media remain independent. */
export function spaEditorialSource(site: SpaPlusSite) {
  return JSON.stringify({ id: site.id, title: text(site.title), titleEN: text(site.titleEN),
    address: text(site.address), city: text(site.city), shortDescription: text(site.shortDescription),
    about: Array.isArray(site.about) ? site.about.map(text) : [],
    opening: Array.isArray(site.opening) ? site.opening.map(text) : [],
    packages: Array.isArray(site.packages) ? site.packages.map((pack) => ({ id: pack.id, title: text(pack.title),
      durationMinutes: pack.durationMinutes, people: pack.people, group: pack.group })).sort((a, b) => a.id - b.id) : [] });
}

export async function spaEditorialSourceHash(site: SpaPlusSite) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(spaEditorialSource(site)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function projectSpaViiSite(site: SpaPlusSite): Promise<SpaPlusSite> {
  let copy;
  try { copy = spaViiCopy(site.id); } catch {
    const place = text(site.city) || "ישראל";
    const title = text(site.title);
    if (!title) throw new Error("catalog_editorial_requires_review");
    return { ...site,
      shortDescription: `${title}, מתחם ספא ב${place}.`,
      about: ["לפני ההזמנה, בדקו מה כלול בחבילה, למי היא מתאימה ומהם תנאי הביטול."] };
  }
  const exactSource = copy.sourceHash === await spaEditorialSourceHash(site);
  const alreadyProjected = text(site.shortDescription) === text(copy.cardSummary)
    && JSON.stringify(Array.isArray(site.about) ? site.about.map(text) : []) === JSON.stringify(copy.paragraphs.map(text));
  const baseline = spaCatalog.sites.find((entry) => entry.id === site.id) as SpaPlusSite | undefined;
  const narrativeUnchanged = baseline && JSON.stringify({ ...JSON.parse(spaEditorialSource(baseline)), packages: undefined })
    === JSON.stringify({ ...JSON.parse(spaEditorialSource(site)), packages: undefined });
  if (!exactSource && !alreadyProjected && !narrativeUnchanged) throw new Error("catalog_editorial_requires_review");
  return { ...site, about: [...copy.paragraphs], shortDescription: copy.cardSummary };
}

export async function validateSpaEditorialCandidate(entries: SupplierCatalogEntry[]) {
  await Promise.all(entries.map(async (entry) => { await projectSpaViiSite(entry.summary as SpaPlusSite); }));
}

export async function projectSpaCatalogEntries(entries: SupplierCatalogEntry[]) {
  return Promise.all(entries.map(async (entry) => ({ ...entry, summary: await projectSpaViiSite(entry.summary as SpaPlusSite) })));
}
