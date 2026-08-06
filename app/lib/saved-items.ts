export const SAVED_ITEMS_KEY = "vii-saved-items-v2";
export const SAVED_ITEMS_EVENT = "vii-saved-items-change";

export type SavedWorld = "vacation" | "events" | "spa" | "hourly" | "providers" | "activities" | "trails";

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

export function readSavedItems(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_ITEMS_KEY) || "[]") as SavedItem[];
    return Array.isArray(value) ? value.filter((item) => item?.key && item?.href && item?.name) : [];
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
