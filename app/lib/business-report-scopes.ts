export const businessReportScopes = ["all", "vacations", "events", "spa", "rooms", "activities", "trails", "providers"] as const;
export type BusinessReportScope = typeof businessReportScopes[number];

const aliases: Record<string, string> = {
  vacation: "vacations",
  vacations: "vacations",
  event: "events",
  events: "events",
  hourly: "rooms",
  room: "rooms",
  rooms: "rooms",
  attractions: "activities",
};

export function canonicalBusinessReportScope(value: string) {
  const normalized = value.trim().toLowerCase();
  return aliases[normalized] || normalized;
}
