const zone = "Asia/Jerusalem";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).reduce<Record<string, string>>((result, part) => { if (part.type !== "literal") result[part.type] = part.value; return result; }, {});
  return values;
}

export function israelDateTimeInputValue(value: string | null) {
  if (!value) return ""; const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) return ""; const valueParts = parts(parsed);
  return `${valueParts.year}-${valueParts.month}-${valueParts.day}T${valueParts.hour}:${valueParts.minute}`;
}

export function israelLocalDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [date, time] = value.split("T"); const [year, month, day] = date.split("-").map(Number); const [hour, minute] = time.split(":").map(Number);
  let candidate = new Date(Date.UTC(year, month - 1, day, hour - 2, minute));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = parts(candidate); const represented = Date.UTC(Number(current.year), Number(current.month) - 1, Number(current.day), Number(current.hour), Number(current.minute));
    const wanted = Date.UTC(year, month - 1, day, hour, minute); candidate = new Date(candidate.getTime() + wanted - represented);
  }
  return israelDateTimeInputValue(candidate.toISOString()) === value ? candidate.toISOString() : null;
}
