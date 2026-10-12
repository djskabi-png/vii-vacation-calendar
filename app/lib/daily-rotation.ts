function israelDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

let cachedMinute = -1;
let cachedDay = "";

function currentIsraelDay(): string {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  if (minute !== cachedMinute) {
    cachedDay = israelDay(now);
    cachedMinute = minute;
  }
  return cachedDay;
}

export function dailyRotationRank(id: string | number, context: string, day = currentIsraelDay()): number {
  const value = `${day}:${context}:${id}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function dailyRotationCompare(
  firstId: string | number, secondId: string | number, context: string, day = currentIsraelDay(),
): number {
  return dailyRotationRank(firstId, context, day) - dailyRotationRank(secondId, context, day)
    || String(firstId).localeCompare(String(secondId));
}

export function rotateDaily<T>(items: readonly T[], id: (item: T) => string | number, context: string, day = currentIsraelDay()): T[] {
  return [...items].sort((first, second) => dailyRotationCompare(id(first), id(second), context, day));
}

export function rotateWithinTiers<T>(
  items: readonly T[], tier: (item: T) => number, id: (item: T) => string | number, context: string, day = currentIsraelDay(),
): T[] {
  return [...items].sort((first, second) => tier(first) - tier(second)
    || dailyRotationCompare(id(first), id(second), context, day));
}
