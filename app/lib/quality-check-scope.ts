import type { QualityCheck } from "./quality-platform.ts";
import { DISCOVERY_READINESS_VERSION, discoveryReadinessDefinitions } from "./quality-readiness.ts";

export type QualityCheckScopeMetadata = {
  definitionVersion: string;
  boxIds: readonly string[];
  requirementIds: readonly string[];
  engine: "http" | "browser" | "data" | "visual" | "unsupported";
  depth: "regular" | "medium" | "full";
  costBudgetMs: number;
  dependencies: readonly string[];
};

export type VersionedQualityCheck = QualityCheck & QualityCheckScopeMetadata & {
  unsupported: boolean;
  unsupportedReason?: string;
};

export type QualityScopeSelection = {
  status: "selected" | "unmapped" | "invalid_graph";
  checks: readonly VersionedQualityCheck[];
  selectedCheckIds: readonly string[];
  reasons: readonly string[];
};

// Every executable entry in the production registry has an explicit owner and
// requirement. These are HTTP contracts only. Browser, visual and interaction
// claims deliberately stay outside this registry and are not inferred here.
const scope = (boxId: string, requirementId: string, depth: QualityCheckScopeMetadata["depth"] = "regular", dependencies: readonly string[] = []): QualityCheckScopeMetadata => ({
  definitionVersion: "1", boxIds: [boxId], requirementIds: [requirementId], engine: "http", depth, costBudgetMs: depth === "full" ? 15_000 : depth === "medium" ? 12_000 : 10_000, dependencies,
});

const metadataEntries: Array<[string, QualityCheckScopeMetadata]> = [
  ["api.catalog-media.vacations", scope("catalog-source", "V07", "full", ["api.catalog.vacations"])],
  ["api.catalog-media.events", scope("catalog-source", "V07", "full", ["api.catalog.events"])],
  ["api.catalog-media.rooms", scope("catalog-source", "V07", "full", ["api.catalog.hourly"])],
  ["api.catalog-media.spa", scope("catalog-source", "V07", "full", ["api.catalog.spa"])],
  ["quality.public-verification-keys", scope("quality-auth", "V17", "full")],
  ["global.home.semantic", scope("global-shell", "V14", "full")],
  ["global.home.en.semantic", scope("multilingual-shell", "V05", "medium")],
  ["global.home.fr.semantic", scope("multilingual-shell", "V05", "medium")],
  ["global.home.ru.semantic", scope("multilingual-shell", "V05", "medium")],
  ["search.location.semantic", scope("search", "V15", "full", ["world.vacations.semantic"])],
  ["place.vacation.semantic", scope("vacations", "V09", "full", ["world.vacations.semantic"])],
  ["place.vacation.legacy-parity", scope("vacations", "V09", "medium", ["place.vacation.semantic"])],
  ["place.vacation.sleeping-fallback", scope("vacations", "V09", "medium", ["place.vacation.semantic"])],
  ["world.vacations.semantic", scope("vacations", "V09", "full")],
  ["world.events.semantic", scope("events", "V09", "full")],
  ["world.events.region.north.semantic", scope("events", "V09", "full", ["world.events.semantic"])],
  ["world.hourly.semantic", scope("hourly", "V09", "full")],
  ["world.spas.semantic", scope("spa", "V09", "full")],
  ["world.attractions.semantic", scope("activities", "V05", "medium")],
  ["place.event.semantic", scope("events", "V09", "medium", ["world.events.semantic"])],
  ["place.hourly.semantic", scope("hourly", "V09", "medium", ["world.hourly.semantic"])],
  ["place.spa.semantic", scope("spa", "V09", "medium", ["world.spas.semantic"])],
  ["world.trails.semantic", scope("trails", "V05", "medium")],
  ["world.providers.semantic", scope("providers", "V05", "medium")],
  ["world.holidays.semantic", scope("vacations", "V09", "medium", ["world.vacations.semantic"])],
  ["world.last-minute.semantic", scope("vacations", "V09", "medium", ["world.vacations.semantic"])],
  ["world.events.last-minute.semantic", scope("events", "V09", "medium", ["world.events.semantic"])],
  ["world.events.thursday.semantic", scope("events", "V09", "medium", ["world.events.semantic"])],
  ["world.events.friday.semantic", scope("events", "V09", "medium", ["world.events.semantic"])],
  ["world.spas.today.semantic", scope("spa", "V09", "medium", ["world.spas.semantic"])],
  ["world.spas.tomorrow.semantic", scope("spa", "V09", "medium", ["world.spas.semantic"])],
  ["map.snapshot.vacation", scope("maps", "V06", "medium", ["place.vacation.semantic"])],
  ["map.snapshot.event", scope("maps", "V06", "medium", ["place.event.semantic"])],
  ["map.snapshot.hourly", scope("maps", "V06", "medium", ["place.hourly.semantic"])],
  ["map.snapshot.spa", scope("maps", "V06", "medium", ["place.spa.semantic"])],
  ["api.catalog.vacations", scope("catalog-source", "V07", "full", ["world.vacations.semantic"])],
  ["api.vacation.amenity-groups", scope("catalog-source", "V07", "medium", ["place.vacation.semantic"])],
  ["api.catalog.events", scope("catalog-source", "V07", "full", ["world.events.semantic"])],
  ["api.catalog.hourly", scope("catalog-source", "V07", "medium", ["world.hourly.semantic"])],
  ["api.catalog.spa", scope("catalog-source", "V07", "medium", ["world.spas.semantic"])],
  ["api.home.presentation", scope("home-sliders", "V16", "medium", ["global.home.semantic"])],
  ["api.starting-prices", scope("catalog-source", "V07", "medium", ["api.catalog.vacations"])],
  ["api.reviews.read", scope("vacations", "V09", "regular", ["place.vacation.semantic"])],
  ["content.guides", scope("content", "V14")],
  ["content.questions", scope("content", "V14")],
  ["content.contact", scope("content", "V14")],
  ["legal.terms", scope("legal", "V18")],
  ["legal.privacy", scope("legal", "V18")],
  ["seo.sitemap.xml", scope("seo", "V15", "medium")],
];

for (const locale of ["en", "fr", "ru"] as const) {
  metadataEntries.push([`locale.${locale}.gift-card.semantic`, scope("multilingual-shell", "V05", "medium")]);
  metadataEntries.push([`locale.${locale}.guides.semantic`, scope("multilingual-shell", "V05", "medium")]);
  metadataEntries.push([`locale.${locale}.place.semantic`, scope("multilingual-shell", "V05", "medium", ["place.vacation.semantic"])]);
}
for (const section of ["core", "holidays", "vacations", "events", "spas", "hourly", "discovery", "search-pages"] as const) {
  metadataEntries.push([`seo.sitemap.${section}`, scope("seo", "V15", "medium")]);
}

for(const entry of discoveryReadinessDefinitions)metadataEntries.push([entry.checkId,{...scope('home-sliders','V16','full',[entry.world==='events'?'world.events.semantic':'world.vacations.semantic']),definitionVersion:DISCOVERY_READINESS_VERSION}]);
export const qualityScopeMetadata: Readonly<Record<string, QualityCheckScopeMetadata>> = Object.fromEntries(metadataEntries);

const EMPTY_METADATA: QualityCheckScopeMetadata = {
  definitionVersion: "unmapped",
  boxIds: [],
  requirementIds: [],
  engine: "unsupported",
  depth: "full",
  costBudgetMs: 0,
  dependencies: [],
};

/**
 * Adapts the existing public registry without guessing ownership. Until an
 * explicit check registry entry maps a check to a box and requirement, it is
 * visible but unsupported and cannot produce a green scoped result.
 */
export function adaptQualityChecks(
  registry: readonly QualityCheck[],
  metadata: Readonly<Record<string, QualityCheckScopeMetadata>> = {},
): readonly VersionedQualityCheck[] {
  return registry.map((check) => {
    const entry = metadata[check.checkId];
    if (!entry) return { ...check, ...EMPTY_METADATA, unsupported: true, unsupportedReason: "missing_explicit_scope_mapping" };
    const invalid = !entry.definitionVersion || !Number.isFinite(entry.costBudgetMs) || entry.costBudgetMs < 0 || entry.engine === "unsupported" || entry.boxIds.length === 0 || entry.requirementIds.length === 0 || entry.dependencies.includes(check.checkId);
    return { ...check, ...entry, costBudgetMs: check.timeoutMs, unsupported: invalid, ...(invalid ? { unsupportedReason: "invalid_scope_mapping" } : {}) };
  });
}

function graphIsValid(checks: readonly VersionedQualityCheck[]) {
  const ids = new Set(checks.map((check) => check.checkId));
  if (ids.size !== checks.length) return false;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    const check = checks.find((entry) => entry.checkId === id);
    if (!check || check.dependencies.some((dependency) => !ids.has(dependency))) return false;
    visiting.add(id);
    for (const dependency of check.dependencies) if (!visit(dependency)) return false;
    visiting.delete(id); visited.add(id); return true;
  };
  return checks.every((check) => visit(check.checkId));
}

/** Selects changed boxes and all transitive consumers. Unknown owners fail
 * closed to an explicit unmapped state, with broad coverage available to the
 * caller rather than an empty or falsely green result. */
export function selectQualityScope(
  checks: readonly VersionedQualityCheck[],
  changedBoxes: readonly string[],
  options: { consumers?: readonly string[]; unknownOwner?: boolean } = {},
): QualityScopeSelection {
  if (!graphIsValid(checks)) return { status: "invalid_graph", checks: [], selectedCheckIds: [], reasons: ["invalid_or_cyclic_dependency_graph"] };
  if (options.unknownOwner) return { status: "unmapped", checks: [...checks], selectedCheckIds: checks.map((check) => check.checkId), reasons: ["unknown_owner_requires_broad_coverage"] };
  const canonicalChangedBoxes = changedBoxes.map((box) => box === "world-landings" ? "vacations" : box);
  if (canonicalChangedBoxes.length === 0 && (!options.consumers || options.consumers.length === 0)) return { status: "unmapped", checks: [], selectedCheckIds: [], reasons: ["empty_scope_requires_explicit_owner"] };
  const knownBoxes = new Set(checks.flatMap((check) => check.boxIds));
  const unknownBoxes = canonicalChangedBoxes.filter((box) => !knownBoxes.has(box));
  if (unknownBoxes.length) return { status: "unmapped", checks: [...checks], selectedCheckIds: checks.map((check) => check.checkId), reasons: [`unknown_boxes:${unknownBoxes.join(",")}`] };
  const knownChecks = new Set(checks.map((check) => check.checkId));
  const unknownConsumers = (options.consumers || []).filter((consumer) => !knownChecks.has(consumer));
  if (unknownConsumers.length) return { status: "unmapped", checks: [...checks], selectedCheckIds: checks.map((check) => check.checkId), reasons: [`unknown_consumers:${unknownConsumers.join(",")}`] };
  const changed = new Set(canonicalChangedBoxes);
  const requestedConsumers = new Set(options.consumers || []);
  const selected = new Set(checks.filter((check) => check.boxIds.some((box) => changed.has(box)) || requestedConsumers.has(check.checkId)).map((check) => check.checkId));
  // A scoped run must contain both sides of the impact graph: prerequisites
  // needed to interpret a changed check, and downstream consumers affected by
  // that change. Expand to a fixed point in both directions.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const check of checks) {
      const isSelected = selected.has(check.checkId);
      const prerequisiteSelected = check.dependencies.some((dependency) => selected.has(dependency));
      const consumerSelected = checks.some((consumer) => selected.has(consumer.checkId) && consumer.dependencies.includes(check.checkId));
      if (prerequisiteSelected || consumerSelected) { if (!isSelected) { selected.add(check.checkId); expanded = true; } }
      if (isSelected) for (const dependency of check.dependencies) if (!selected.has(dependency)) { selected.add(dependency); expanded = true; }
    }
  }
  const depth = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const check = checks.find((entry) => entry.checkId === id);
    return check ? Math.max(0, ...check.dependencies.map((dependency) => depth(dependency, new Set(seen)))) + 1 : 0;
  };
  const chosen = checks.filter((check) => selected.has(check.checkId)).sort((a, b) => depth(a.checkId) - depth(b.checkId));
  const unsupported = chosen.filter((check) => check.unsupported);
  return {
    status: unsupported.length ? "unmapped" : "selected",
    checks: chosen,
    selectedCheckIds: chosen.map((check) => check.checkId),
    reasons: unsupported.length ? ["selected_scope_contains_unmapped_checks"] : [],
  };
}
