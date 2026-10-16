export type WorldDepthTopic = { readonly slug: string; readonly label: string; readonly params: Readonly<Record<string, string>> };

export const activityDepthTopics: readonly WorldDepthTopic[] = [
  { slug: "north", label: "אטרקציות בצפון", params: { area: "צפון" } },
  { slug: "kineret", label: "אטרקציות בכנרת", params: { area: "כנרת" } },
  { slug: "center", label: "אטרקציות במרכז", params: { area: "מרכז ותל אביב" } },
  { slug: "jerusalem", label: "אטרקציות בירושלים", params: { area: "ירושלים" } },
  { slug: "south", label: "אטרקציות בדרום", params: { area: "דרום ונגב" } },
  { slug: "eilat", label: "אטרקציות באילת והסביבה", params: { area: "אילת והסביבה" } },
  { slug: "water-family", label: "אטרקציות מים ומשפחה", params: { type: "מים ומשפחה" } },
  { slug: "nature-riding", label: "אטרקציות טבע ורכיבה", params: { type: "טבע ורכיבה" } },
  { slug: "food-culture", label: "אטרקציות אוכל ותרבות", params: { type: "אוכל ותרבות" } },
];

export const trailDepthTopics: readonly WorldDepthTopic[] = [
  ...[{ slug: "north", area: "צפון" }, { slug: "kineret", area: "כנרת" }, { slug: "haifa", area: "חיפה" }, { slug: "center", area: "מרכז" }, { slug: "tel-aviv", area: "תל אביב" }, { slug: "south", area: "דרום ונגב" }, { slug: "jerusalem", area: "ירושלים" }, { slug: "eilat", area: "אילת והסביבה" }].map(({ slug, area }) => ({ slug, label: `מסלולים ב${area}`, params: { area } })),
  { slug: "water", label: "מסלולי מים", params: { nature: "מים" } },
  { slug: "springs", label: "מסלולי מעיינות", params: { nature: "מעיינות" } },
  { slug: "forest", label: "מסלולי יער", params: { nature: "יער" } },
  { slug: "easy", label: "מסלולים קלים", params: { difficulty: "קל" } },
  { slug: "moderate", label: "מסלולים בדרגת קושי בינונית", params: { difficulty: "בינוני" } },
];

export function findDepthTopic(topics: readonly WorldDepthTopic[], slug: string) {
  return topics.find((topic) => topic.slug === slug) || null;
}
