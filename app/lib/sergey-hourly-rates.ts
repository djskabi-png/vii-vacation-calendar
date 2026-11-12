export type SergeyHourlyRate = {
  duration: "שעה" | "שעתיים" | "3 שעות" | "לילה";
  weekday: number | null;
  weekend: number | null;
};

type Source = Record<string, unknown>;

function record(value: unknown): Source {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Source : {};
}

function positive(value: unknown) {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value)
      : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function firstPositive(sources: Source[], keys: string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = positive(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

/**
 * One bounded supplier-rate contract for both the build-time importer and the
 * runtime catalog pull. The rooms feed has used paired day-group fields and
 * scalar overnight fields in different projections. We accept only explicit,
 * semantically exact aliases and only positive integers. Unknown keys never
 * become public prices.
 */
export function normalizeSergeyHourlyRates(basePrices: unknown, roomValue?: unknown): SergeyHourlyRate[] {
  const base = record(basePrices);
  const room = record(roomValue);
  const sources = [base, room];
  const hourly: SergeyHourlyRate[] = [
    { duration: "שעה", weekday: firstPositive(sources, ["hourPriceWeekday"]), weekend: firstPositive(sources, ["hourPriceWeekend"]) },
    { duration: "שעתיים", weekday: firstPositive(sources, ["twoHourPriceWeekday"]), weekend: firstPositive(sources, ["twoHourPriceWeekend"]) },
    { duration: "3 שעות", weekday: firstPositive(sources, ["threeHourPriceWeekday"]), weekend: firstPositive(sources, ["threeHourPriceWeekend"]) },
  ];
  const scalarNight = firstPositive(sources, ["overnightPrice", "nightPrice", "pricePerNight", "nightlyPrice"]);
  const night: SergeyHourlyRate = {
    duration: "לילה",
    weekday: firstPositive(sources, ["overnightPriceWeekday", "nightPriceWeekday", "overnightWeekdayPrice", "nightWeekdayPrice"]) ?? scalarNight,
    weekend: firstPositive(sources, ["overnightPriceWeekend", "nightPriceWeekend", "overnightWeekendPrice", "nightWeekendPrice"]) ?? scalarNight,
  };
  return [...hourly, night].filter((rate) => rate.weekday !== null || rate.weekend !== null);
}
