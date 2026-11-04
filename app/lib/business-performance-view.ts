export const businessPerformanceViews = ["overview", "businesses", "sales", "contacts", "history"] as const;
export type BusinessPerformanceView = typeof businessPerformanceViews[number];
export function businessPerformanceView(value: string): BusinessPerformanceView {
  return businessPerformanceViews.includes(value as BusinessPerformanceView) ? value as BusinessPerformanceView : "overview";
}
export function reportPage<T>(rows: readonly T[], requestedPage: number, pageSize = 50) {
  const size = Math.max(1, Math.min(100, Math.floor(pageSize) || 50));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(1, Math.min(pages, Math.floor(requestedPage) || 1));
  const offset = (page - 1) * size;
  return { items: rows.slice(offset, offset + size), page, pages, total: rows.length,
    start: rows.length ? offset + 1 : 0, end: Math.min(rows.length, offset + size) };
}
