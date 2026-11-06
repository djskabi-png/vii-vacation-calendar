import { spaViiCopy } from "../data/spa-vii-copy.ts";
import type { SpaPlusSite } from "../data/spaplus";
import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { SpaEditorialReviewError, catalogDiagnosticLimit,
  type CatalogSyncDiagnostics } from "./supplier-catalog-diagnostics.ts";
import { isBannedPublicMedia } from "./public-media-policy.ts";
import officialFacilityEvidence from "../data/spaplus-official-facility-evidence.json" with { type: "json" };

function text(value: unknown) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

function withCanonicalSpaImage(site: SpaPlusSite): SpaPlusSite {
  const gallery = Array.isArray(site.gallery)
    ? site.gallery.filter((image) => Boolean(image) && !isBannedPublicMedia(image))
    : [];
  const image = site.image && !isBannedPublicMedia(site.image)
    && (gallery.length === 0 || gallery.includes(site.image))
    ? site.image
    : gallery[0];
  return { ...site, image, gallery };
}

type SpaFacilityEvidence = {
  labels?: string[];
  providerFacilityIds?: number[];
  optionalFeatures?: { label: string; kind?: string; packageId?: string; sourceQuote?: string }[];
};

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
  const canonicalSite = withCanonicalSpaImage(site);
  const evidence = (officialFacilityEvidence.entries as Record<string, SpaFacilityEvidence>)[String(site.id)];
  const evidenceLabels = evidence?.labels || [];
  const optionalLabels = evidence?.optionalFeatures?.map((feature) => feature.label) || [];
  const evidenceIds = evidence?.providerFacilityIds || [];
  const withFacilities = evidence
    ? { ...canonicalSite,
      facilityIds: [...new Set([...(canonicalSite.facilityIds || []), ...evidenceIds])].sort((a, b) => a - b),
      features: [...new Set([...(canonicalSite.features || []), ...evidenceLabels, ...optionalLabels])] }
    : canonicalSite;
  let copy;
  try { copy = spaViiCopy(site.id); } catch {
    const place = text(site.city) || "ישראל";
    const title = text(site.title);
    if (!title) throw new SpaEditorialReviewError({ total: 1, truncated: false,
      rejected: [{ supplierId: site.id, fields: ["title"], reason: "missing_title" }] });
    return { ...withFacilities,
      shortDescription: `${title}, מתחם ספא ב${place}.`,
      about: ["לפני ההזמנה, בדקו מה כלול בחבילה, למי היא מתאימה ומהם תנאי הביטול."] };
  }
  // Existing reviewed places always keep VII-owned narrative copy. Supplier
  // factual changes such as title, address, hours and packages may therefore
  // refresh without turning a harmless upstream edit into a catalog-wide
  // editorial rejection. The source hash remains audit evidence for the
  // original review, not a publication lock on all future supplier facts.
  return { ...withFacilities, about: [...copy.paragraphs], shortDescription: copy.cardSummary };
}

export async function validateSpaEditorialCandidate(entries: SupplierCatalogEntry[]) {
  const reviews = await Promise.all(entries.map(async (entry) => {
    try { await projectSpaViiSite(entry.summary as SpaPlusSite); return undefined; }
    catch (error) {
      if (!(error instanceof SpaEditorialReviewError)) throw error;
      return error.diagnostics.spaEditorialReview;
    }
  }));
  const rejected: NonNullable<CatalogSyncDiagnostics["spaEditorialReview"]>["rejected"] = [];
  let total = 0;
  for (const review of reviews) {
    if (!review) continue;
    total += review.total;
    rejected.push(...review.rejected.slice(0, Math.max(0, catalogDiagnosticLimit - rejected.length)));
  }
  if (total) throw new SpaEditorialReviewError({ total, rejected, truncated: total > rejected.length });
}

export async function projectSpaCatalogEntries(entries: SupplierCatalogEntry[]) {
  return Promise.all(entries.map(async (entry) => ({ ...entry, summary: await projectSpaViiSite(entry.summary as SpaPlusSite) })));
}
