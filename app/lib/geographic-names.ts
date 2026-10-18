/** Names are search identities, never supplier IDs or replacements for coordinates. */
const normalizedNames = new Map<string, string>();
export function normalizeGeographicName(value?: string | null): string {
  const source = value || "";
  const prior = normalizedNames.get(source);
  if (prior !== undefined) return prior;
  const normalized = source.normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .toLocaleLowerCase("he").replace(/[׳״'".,()\[\]־–—\-/]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/קריית/g, "קרית");
  // Only short geographic labels, bounded per isolate; never persistent storage.
  if (source.length <= 128) {
    if (normalizedNames.size >= 1024) normalizedNames.delete(normalizedNames.keys().next().value!);
    normalizedNames.set(source, normalized);
  }
  return normalized;
}

const nameGroups = [
  { label: "חיפה", aliases: ["Haifa", "Haïfa"] },
  { label: "תל אביב", aliases: ["תל אביב יפו", "תל-אביב-יפו", "ת״א", "Tel Aviv", "Tel Aviv Yafo"] },
  { label: "חיפה והכרמל", aliases: ["חיפה וחוף הכרמל", "חיפה והסביבה", "חיפה והקריות", "אזור חיפה", "Haifa and Carmel", "Haifa and Hof HaCarmel", "haifa-carmel"], anchor: "חיפה",
    cities: ["חיפה", "נשר", "טירת כרמל", "עתלית", "דאלית אל כרמל", "דלית אל כרמל", "עספיא", "עוספיא", "גבע כרמל", "עין כרמל", "קיסריה", "קרית אתא", "קרית ביאליק", "קרית מוצקין", "קרית ים", "קרית חיים", "קרית שמואל"], areas: ["קריות", "חוף הכרמל"] },
  { label: "תל אביב וגוש דן", aliases: ["גוש דן", "תל אביב והסביבה", "אזור תל אביב", "Tel Aviv Metropolitan Area", "Tel Aviv and Gush Dan", "Gush Dan", "tel-aviv-area"], anchor: "תל אביב",
    cities: ["תל אביב", "יפו", "רמת גן", "גבעתיים", "בני ברק", "חולון", "בת ים", "פתח תקווה", "גבעת שמואל", "קרית אונו", "אור יהודה", "יהוד", "יהוד מונוסון", "ראשון לציון", "הרצליה", "רמת השרון", "גני תקווה", "סביון", "אזור", "בית דגן"], areas: [] },
] as const;

const aliases = new Map<string, (typeof nameGroups)[number]>();
for (const group of nameGroups) for (const name of [group.label, ...group.aliases]) aliases.set(normalizeGeographicName(name), group);
const groupFor = (value?: string | null) => aliases.get(normalizeGeographicName(value));
const metropolitanMembers = new Map(nameGroups.flatMap(group => "cities" in group ? [[group.label, {
  cities: new Set(group.cities.map(normalizeGeographicName)),
  areas: new Set([group.label, ...group.areas].map(normalizeGeographicName)),
}] as const] : []));

export function canonicalSearchLocation(value?: string | null): string {
  return groupFor(value)?.label || (value || "").trim();
}

export function uniqueSearchLocations(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap(value => {
    const label = canonicalSearchLocation(value), key = normalizeGeographicName(label);
    if (!key || seen.has(key)) return [];
    seen.add(key); return [label];
  });
}

export function locationMatchesQuery(label: string, query: string): boolean {
  const target = normalizeGeographicName(query), group = groupFor(label);
  return [label, ...(group?.aliases || [])].some(name => normalizeGeographicName(name).includes(target));
}

export function geographicAnchorSelection(selection: string): string | null {
  const group = groupFor(selection);
  return group && "anchor" in group ? group.anchor : null;
}

/** Explicit metro membership only. A city query stays distinct from a metro query. */
export function metropolitanLocationMatches(place: { area?: string; location?: string }, selection: string): boolean | null {
  const group = groupFor(selection);
  if (!group || !("cities" in group)) return null;
  const city = normalizeGeographicName(canonicalSearchLocation(place.location));
  const area = normalizeGeographicName(canonicalSearchLocation(place.area));
  const members = metropolitanMembers.get(group.label)!;
  return members.areas.has(area) || members.cities.has(city);
}
