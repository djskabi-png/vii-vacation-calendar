export type FlexibleVacationStay = "weekend" | "long-weekend" | "week" | "month";

export type FlexibleVacationSearch = {
  stay: FlexibleVacationStay;
  month: string;
  days: number;
};

export type FlexibleVacationCandidate = {
  from: string;
  till: string;
  guests: number;
};

type SearchParamsReader = { get(name: string): string | null };

const flexibleStays = new Set<FlexibleVacationStay>(["weekend", "long-weekend", "week", "month"]);
const flexibleDays = new Set([0, 1, 3, 7]);

const settings: Record<FlexibleVacationStay, { nights: number; preferredWeekday: number }> = {
  weekend: { nights: 2, preferredWeekday: 5 },
  "long-weekend": { nights: 3, preferredWeekday: 4 },
  week: { nights: 7, preferredWeekday: 5 },
  month: { nights: 30, preferredWeekday: 0 },
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function plusDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function flexibleVacationSearchFromParams(searchParams: SearchParamsReader): FlexibleVacationSearch | null {
  if (searchParams.get("dateMode") !== "flexible") return null;
  const stay = searchParams.get("stay") as FlexibleVacationStay | null;
  const month = searchParams.get("month") || "";
  const days = Number(searchParams.get("flexDays"));
  if (!stay || !flexibleStays.has(stay) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !flexibleDays.has(days)) return null;
  return { stay, month, days };
}

/**
 * Produces stable, shareable date ranges for a flexible request. Weekend
 * searches always try the actual Friday-to-Sunday weekend first. Extra
 * flexibility is used only afterwards, ordered by the smallest deviation.
 */
export function flexibleVacationCandidates(search: FlexibleVacationSearch | null, guests = 2): FlexibleVacationCandidate[] {
  if (!search) return [];
  const config = settings[search.stay];
  const monthStart = new Date(`${search.month}-01T12:00:00Z`);
  if (Number.isNaN(monthStart.getTime())) return [];
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 12));
  const safeGuests = Math.max(1, Math.floor(guests) || 2);

  if (search.stay === "month") {
    return [{ from: isoDate(monthStart), till: isoDate(plusDays(monthStart, config.nights)), guests: safeGuests }];
  }

  const preferredStarts: Date[] = [];
  for (let day = new Date(monthStart); day < monthEnd; day = plusDays(day, 1)) {
    if (day.getUTCDay() === config.preferredWeekday) preferredStarts.push(day);
  }

  const offsets = [0, ...Array.from({ length: search.days }, (_, index) => index + 1).flatMap((day) => [-day, day])];
  const seen = new Set<string>();
  const candidates: FlexibleVacationCandidate[] = [];
  // Keep the intent order globally stable: every exact weekend in the selected
  // month is tried before the flexible fallbacks. This is what keeps a real
  // Friday to Sunday result above a nearby Thursday to Saturday result.
  for (const offset of offsets) {
    for (const preferredStart of preferredStarts) {
      const from = plusDays(preferredStart, offset);
      if (from < monthStart || from >= monthEnd) continue;
      const candidate = { from: isoDate(from), till: isoDate(plusDays(from, config.nights)), guests: safeGuests };
      const key = `${candidate.from}|${candidate.till}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }
  return candidates;
}
