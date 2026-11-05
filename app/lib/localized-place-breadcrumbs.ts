type Breadcrumb = { name: string; path?: string };

/** Canonical location pages carry geography in their label, not a query. */
export function localizedPlaceBreadcrumbs(items: Breadcrumb[], language: string, prefix: string, localize: (value: string) => string): Breadcrumb[] {
  return items.map(entry => {
    if (language === "he") return entry;
    const location = (entry.path ? new URL(entry.path, "https://vii.local").searchParams.get("location") : null)
      || entry.name.replace(/^(?:חדרים לפי שעה|מקומות לאירועים|ספא|אטרקציות|ספקים|מסלולי טיול)\s+ב/, "");
    return { ...entry, name: `${prefix}${localize(location)}` };
  });
}
