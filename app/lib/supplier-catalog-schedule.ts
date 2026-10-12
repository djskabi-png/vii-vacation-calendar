import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

const schedule: Record<string, SupplierCatalogWorld> = {
  "05:00": "vacations", "05:30": "events", "06:00": "rooms", "06:30": "spa",
  "12:00": "vacations", "12:30": "events", "13:00": "rooms", "13:30": "spa",
  "17:00": "vacations", "17:30": "events", "18:00": "rooms", "18:30": "spa",
};

export function scheduledCatalogWorld(date: Date): SupplierCatalogWorld | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return schedule[`${hour}:${minute}`] || null;
}
