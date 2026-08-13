export const SAVED_ITEMS_KEY = "vii-saved-items-v2";
export const SAVED_ITEMS_EVENT = "vii-saved-items-change";

export type SavedWorld = "vacation" | "events" | "corporate" | "spa" | "hourly" | "providers" | "activities" | "trails";

export type SavedItem = {
  key: string;
  id: string;
  world: SavedWorld;
  name: string;
  location: string;
  image?: string;
  href: string;
  meta?: string;
  savedAt: string;
};

/**
 * Favorite links are persisted on the device, so an old route can survive a
 * deployment long after the site's canonical detail route changes. Normalize
 * every saved destination from the stable world and id before rendering it.
 */
export function canonicalSavedItemHref(item: Pick<SavedItem, "world" | "id" | "href">) {
  if (item.world === "vacation") return `/business?id=${encodeURIComponent(item.id)}`;
  if (item.world === "events") {
    return item.href.startsWith("/business?")
      ? item.href
      : `/events/place/${encodeURIComponent(item.id)}`;
  }
  if (item.world === "corporate") return "/corporate";
  if (item.world === "trails") return `/trails/${encodeURIComponent(item.id)}`;
  return `/discover/place/${encodeURIComponent(item.id)}`;
}

export function readSavedItems(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_ITEMS_KEY) || "[]") as SavedItem[];
    return Array.isArray(value)
      ? value
        .filter((item) => item?.key && item?.id && item?.href && item?.name)
        .map((item) => ({ ...item, href: canonicalSavedItemHref(item) }))
      : [];
  } catch {
    return [];
  }
}

export function writeSavedItems(items: SavedItem[]) {
  window.localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(SAVED_ITEMS_EVENT));
}

export function savedItemKey(world: SavedWorld, id: string) {
  return `${world}:${id}`;
}
