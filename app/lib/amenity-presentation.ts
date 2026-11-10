export function amenityPresentation<T>(items: readonly T[], viewport: "mobile" | "desktop", expanded = false) {
  const limit = viewport === "mobile" ? 4 : 12;
  const all = [...items];
  return { all, visible: expanded ? all : all.slice(0, limit), canExpand: all.length > limit, limit };
}
