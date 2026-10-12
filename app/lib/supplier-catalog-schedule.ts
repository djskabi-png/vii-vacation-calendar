import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

const schedule: Record<string, SupplierCatalogWorld> = {
  "05:00": "vacations", "05:30": "events", "06:00": "rooms", "06:30": "spa",
  "12:00": "vacations", "12:30": "events", "13:00": "rooms", "13:30": "spa",
  "17:00": "vacations", "17:30": "events", "18:00": "rooms", "18:30": "spa",
};

// A delayed task may cover today's latest approved slot, never a caller-selected date or run ID.
export function catalogPullSlot(date: Date, world: SupplierCatalogWorld) {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value || "";
  const time = `${part("hour")}:${part("minute")}`;
  const slot = Object.keys(schedule).filter((key) => schedule[key] === world && key <= time).sort().at(-1);
  if (!slot) return null;
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  return { world, slot, localDate, id: `mcp_${localDate.replaceAll("-", "")}_${world}_${slot.replace(":", "")}` };
}

export function scheduledCatalogWorld(date: Date): SupplierCatalogWorld | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return schedule[`${hour}:${minute}`] || null;
}
