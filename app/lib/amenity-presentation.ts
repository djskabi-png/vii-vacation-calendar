export function amenityPresentation<T>(items: readonly T[], viewport: "mobile" | "desktop", expanded = false) {
  void viewport;
  const limit = 5;
  const all = [...items];
  return { all, visible: expanded ? all : all.slice(0, limit), canExpand: all.length > limit, limit };
}
