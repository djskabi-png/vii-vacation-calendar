export const maxHomeHolidayTabs = 6;

export function clampHomeHolidayLimit(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(maxHomeHolidayTabs, Math.max(1, parsed)) : maxHomeHolidayTabs;
}
