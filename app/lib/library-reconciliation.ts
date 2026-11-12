import type { SavedWorld } from "./saved-items";

export const LIBRARY_PAGE_SIZE = 9;
export const LIBRARY_VALIDATION_BATCH_SIZE = 50;

const validatedWorlds = new Set<SavedWorld>([
  "vacation",
  "events",
  "corporate",
  "spa",
  "hourly",
  "providers",
  "activities",
  "trails",
]);

export type LibraryValidationItem = { world: SavedWorld; id: string };

export function libraryValidationItems(items: Array<{ world: SavedWorld; id: string; key: string }>) {
  const unique = new Map<string, LibraryValidationItem>();
  for (const item of items) {
    if (!validatedWorlds.has(item.world) || !/^[a-z0-9-]{1,100}$/.test(item.id)) continue;
    unique.set(item.key, { world: item.world, id: item.id });
  }
  return [...unique.values()];
}

export function reconcileCheckedLibraryItems<T extends { key: string }>(
  items: T[],
  checkedKeys: ReadonlySet<string>,
  existingKeys: ReadonlySet<string>,
) {
  return items.filter((item) => !checkedKeys.has(item.key) || existingKeys.has(item.key));
}
