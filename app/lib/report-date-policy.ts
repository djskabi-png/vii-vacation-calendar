const israelDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function israelDay(now = new Date()) {
  return israelDayFormatter.format(now);
}

export function isClosedReportPeriod(till: string, now = new Date()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(till) && till < israelDay(now);
}


