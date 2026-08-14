import { canonicalSavedItemHref, savedItemKey, type SavedItem, type SavedWorld } from "./saved-items";

export const VIEWED_ITEMS_KEY = "vii-viewed-items-v1";
export const VIEWED_ITEMS_EVENT = "vii-viewed-items-change";
export const MAX_VIEWED_ITEMS = 60;

export type ViewedItem = Omit<SavedItem, "savedAt"> & { viewedAt: string };

export function readViewedItems(): ViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(VIEWED_ITEMS_KEY) || "[]") as ViewedItem[];
    return Array.isArray(value)
      ? value
        .filter((item) => item?.key && item?.id && item?.href && item?.name && item?.viewedAt)
        .map((item) => ({ ...item, href: canonicalSavedItemHref(item) }))
        .sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt))
        .slice(0, MAX_VIEWED_ITEMS)
      : [];
  } catch {
    return [];
  }
}

export function writeViewedItems(items: ViewedItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VIEWED_ITEMS_KEY, JSON.stringify(items.slice(0, MAX_VIEWED_ITEMS)));
  window.dispatchEvent(new Event(VIEWED_ITEMS_EVENT));
}

export function rememberViewedItem(item: {
  id: string;
  world: SavedWorld;
  name: string;
  location: string;
  image?: string;
  href: string;
  meta?: string;
}) {
  const key = savedItemKey(item.world, item.id);
  const current = readViewedItems().filter((entry) => entry.key !== key);
  writeViewedItems([{ ...item, key, viewedAt: new Date().toISOString() }, ...current]);
}

export function clearViewedItems() {
  writeViewedItems([]);
}
