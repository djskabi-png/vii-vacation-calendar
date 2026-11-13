export type ContentQueueStatus = "pending" | "draft" | "review" | "scheduled";

export type ContentQueueFilterItem = {
  title: string;
  location: string;
  world: string;
  status: ContentQueueStatus;
  searches: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type ContentQueueFilters = {
  query: string;
  status: "all" | ContentQueueStatus;
  world: "all" | string;
  from: string;
  to: string;
  minSearches: string;
  maxSearches: string;
};

const israelDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function israelDateKey(value: string) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "";
  const parts = Object.fromEntries(israelDateFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function threshold(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function contentQueueRangeError(filters: Pick<ContentQueueFilters, "minSearches" | "maxSearches" | "from" | "to">) {
  const minimum = threshold(filters.minSearches);
  const maximum = threshold(filters.maxSearches);
  if (minimum !== null && maximum !== null && minimum > maximum) return "כמות החיפושים המינימלית גבוהה מהמקסימלית.";
  if (filters.from && filters.to && filters.from > filters.to) return "תאריך ההתחלה מאוחר מתאריך הסיום.";
  return "";
}

export function filterContentQueue<T extends ContentQueueFilterItem>(items: T[], filters: ContentQueueFilters, worldLabels: Record<string, string>) {
  const rangeError = contentQueueRangeError(filters);
  const term = filters.query.trim().toLocaleLowerCase("he");
  const minimum = rangeError ? null : threshold(filters.minSearches);
  const maximum = rangeError ? null : threshold(filters.maxSearches);
  return items.filter((item) => {
    const lastSeen = israelDateKey(item.lastSeenAt);
    return (filters.status === "all" || item.status === filters.status)
      && (filters.world === "all" || item.world === filters.world)
      && (!term || `${item.title} ${item.location} ${worldLabels[item.world] || item.world}`.toLocaleLowerCase("he").includes(term))
      && (!filters.from || lastSeen >= filters.from)
      && (!filters.to || lastSeen <= filters.to)
      && (minimum === null || item.searches >= minimum)
      && (maximum === null || item.searches <= maximum);
  });
}
