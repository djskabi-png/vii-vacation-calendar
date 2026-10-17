export function eventDealDate(offset: number, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value || 0);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") + offset)).toISOString().slice(0, 10);
}

export function eventDealPresets(now = new Date()) {
  const today = eventDealDate(0, now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const next = (day: number) => eventDealDate((day - weekday + 7) % 7 || 7, now);
  return [{ id: "lastminute", date: eventDealDate(1, now) }, { id: "thursday", date: next(4) }, { id: "friday", date: next(5) }];
}
