import type { QualityCheck } from "./quality-platform.ts";

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

// These are the only production mappings wired in this slice. The identifiers
// reuse existing registry families, so no new box is invented here. All other
// checks remain explicitly unsupported until their owner is mapped.
export const qualityScopeMetadata: Readonly<Record<string, QualityCheckScopeMetadata>> = {
  "world.vacations.semantic": { definitionVersion: "1", boxIds: ["world-landings"], requirementIds: ["A02"], engine: "http", depth: "regular", costBudgetMs: 1_000, dependencies: [] },
  "search.location.semantic": { definitionVersion: "1", boxIds: ["search"], requirementIds: ["A10"], engine: "http", depth: "medium", costBudgetMs: 2_000, dependencies: ["world.vacations.semantic"] },
};

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
    const invalid = !entry.definitionVersion || entry.costBudgetMs < 0 || entry.boxIds.length === 0 || entry.requirementIds.length === 0 || entry.dependencies.includes(check.checkId);
    return { ...check, ...entry, unsupported: invalid, ...(invalid ? { unsupportedReason: "invalid_scope_mapping" } : {}) };
  });
}

function graphIsValid(checks: readonly VersionedQualityCheck[]) {
  const ids = new Set(checks.map((check) => check.checkId));
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
  if (changedBoxes.length === 0 && (!options.consumers || options.consumers.length === 0)) return { status: "unmapped", checks: [], selectedCheckIds: [], reasons: ["empty_scope_requires_explicit_owner"] };
  const knownBoxes = new Set(checks.flatMap((check) => check.boxIds));
  const unknownBoxes = changedBoxes.filter((box) => !knownBoxes.has(box));
  if (unknownBoxes.length) return { status: "unmapped", checks: [...checks], selectedCheckIds: checks.map((check) => check.checkId), reasons: [`unknown_boxes:${unknownBoxes.join(",")}`] };
  const knownChecks = new Set(checks.map((check) => check.checkId));
  const unknownConsumers = (options.consumers || []).filter((consumer) => !knownChecks.has(consumer));
  if (unknownConsumers.length) return { status: "unmapped", checks: [...checks], selectedCheckIds: checks.map((check) => check.checkId), reasons: [`unknown_consumers:${unknownConsumers.join(",")}`] };
  const changed = new Set(changedBoxes);
  const requestedConsumers = new Set(options.consumers || []);
  const selected = new Set(checks.filter((check) => check.boxIds.some((box) => changed.has(box)) || requestedConsumers.has(check.checkId)).map((check) => check.checkId));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const check of checks) {
      if (selected.has(check.checkId) || check.dependencies.some((dependency) => selected.has(dependency))) {
        if (!selected.has(check.checkId)) { selected.add(check.checkId); expanded = true; }
      }
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
