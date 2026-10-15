const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

export type IsraelGreeting = "בוקר טוב" | "צהריים טובים" | "ערב טוב" | "לילה טוב";

export function getIsraelHour(now: Date = new Date()): number {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: ISRAEL_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour");

  return Number(hourPart?.value ?? 0);
}

export function getIsraelGreeting(now: Date = new Date()): IsraelGreeting {
  const hour = getIsraelHour(now);
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 21) return "ערב טוב";
  return "לילה טוב";
}
