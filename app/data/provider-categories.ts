import type { DiscoveryItem } from "./world-data";

export type ProviderCategoryId = "all" | "food" | "music" | "entertainment" | "photo" | "design" | "bar" | "wellness";

export type ProviderCategory = {
  id: ProviderCategoryId;
  label: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  tokens: readonly string[];
};

export const providerCategories: readonly ProviderCategory[] = [
  {
    id: "all",
    label: "הכל",
    title: "ספקים לאירוח ולאירועים",
    description: "שפים, מוזיקה, צילום, עיצוב ופעילויות במקום אחד.",
    metaTitle: "ספקים לחופשה ולאירוע במקום אחד",
    metaDescription: "שפים פרטיים, תקליטנים, צילום, ברים, עיצוב ופעילויות שמגיעים עד מקום האירוח.",
    tokens: [],
  },
  {
    id: "food",
    label: "שפים ואוכל",
    title: "שפים פרטיים וקייטרינג לאירוח ולאירועים",
    description: "ארוחות שף, קייטרינג ותפריטים מותאמים שמגיעים לבית, לווילה או למקום האירוע.",
    metaTitle: "שפים פרטיים וקייטרינג לאירוח ולאירועים",
    metaDescription: "מצאו שפים פרטיים ושירותי קייטרינג לאירוח, לחופשה ולאירועים, עם תפריטים ושירות שמגיעים למקום.",
    tokens: ["שף", "קייטרינג"],
  },
  {
    id: "music",
    label: "מוזיקה",
    title: "תקליטנים ומוזיקה לאירועים",
    description: "תקליטנים ועורכים מוזיקליים לחתונות, מסיבות, אירועים פרטיים ואירועי חברה.",
    metaTitle: "תקליטנים ומוזיקה לחתונות ולאירועים",
    metaDescription: "מצאו תקליטנים ושירותי מוזיקה לחתונות, מסיבות ואירועי חברה לפי סגנון האירוע והמיקום.",
    tokens: ["תקליטן", "מוזיקלי", "dj"],
  },
  {
    id: "entertainment",
    label: "מופעים ואמנים",
    title: "מופעים ואמנים לאירועים",
    description: "קסמים, אמנות חושים ותוכן אינטראקטיבי למשפחות, לחברות ולקבלות פנים.",
    metaTitle: "מופעים ואמנים לאירועים פרטיים ועסקיים",
    metaDescription: "מצאו מופעים, קוסמים ואמני חושים לאירועים פרטיים, משפחתיים ועסקיים בהתאמה לקהל.",
    tokens: ["אמן חושים", "קוסם", "מופע", "בידור"],
  },
  {
    id: "photo",
    label: "צילום",
    title: "צילום לאירועים",
    description: "צילום סטילס, וידאו, עריכה ותוצרים לאירועים משפחתיים, פרטיים ועסקיים.",
    metaTitle: "צלמים ושירותי צילום לאירועים",
    metaDescription: "מצאו צלמים ושירותי צילום סטילס ווידאו לחתונות, לאירועים משפחתיים ולאירועי חברה.",
    tokens: ["צילום", "סטילס", "וידאו"],
  },
  {
    id: "design",
    label: "עיצוב",
    title: "עיצוב אירועים, בלונים וקונספט",
    description: "עיצוב חלל, פרחים, חופות, בלונים ומיתוג שמותאמים לאופי האירוע ולמקום.",
    metaTitle: "עיצוב אירועים, בלונים וקונספט",
    metaDescription: "מצאו ספקי עיצוב לאירועים, עיצוב בלונים, פרחים, חופות, מיתוג ופיתוח קונספט למקום האירוע.",
    tokens: ["בלונים", "קונספט", "עיצוב"],
  },
  {
    id: "bar",
    label: "ברים",
    title: "ברים וקוקטיילים לאירועים",
    description: "שירותי בר, ברמנים, מיקסולוגיה וקוקטיילים לאירועים פרטיים ולאירועי חברה.",
    metaTitle: "ברים וקוקטיילים לאירועים",
    metaDescription: "מצאו שירותי בר, ברמנים וקוקטיילים לחתונות, למסיבות ולאירועי חברה לפי גודל ואופי האירוע.",
    tokens: ["בר קוקטיילים", "ברמנים", "קוקטייל", "מיקסולוגיה"],
  },
  {
    id: "wellness",
    label: "רווחה ותנועה",
    title: "טיפולי רווחה ותנועה שמגיעים אליכם",
    description: "עיסוי, יוגה, נשימה ופעילויות רווחה לבית, לווילה, למשרד או לאירוע.",
    metaTitle: "טיפולי רווחה ותנועה במקום האירוח",
    metaDescription: "מצאו עיסוי, יוגה ופעילויות רווחה שמגיעים לבית, לווילה, למשרד, לחופשה או לאירוע.",
    tokens: ["יוגה", "נשימה", "עיסוי", "רווחה"],
  },
] as const;

export const providerTopicCategories = providerCategories.filter((category) => category.id !== "all");

const providerCategoryAssignments: Record<string, readonly Exclude<ProviderCategoryId, "all">[]> = {
  "masu-home-wellness": ["wellness"],
  "maor-natan": ["food"],
  "nissan-mukhtar": ["food"],
  "amit-mitrani-magic-man": ["entertainment"],
  "dj-kfir-w": ["music"],
  "liran-elias-dj": ["music"],
  photoshot: ["photo"],
  baboom: ["design"],
  balloona: ["design"],
  "hagit-designed-events": ["design"],
  "aae-event-design": ["design"],
  "argaman-events": ["photo", "design"],
  "bp-cocktails": ["bar"],
  "onyx-bar": ["bar"],
  "zen-events": ["wellness"],
};

export function getProviderCategory(value: string | undefined) {
  return providerCategories.find((category) => category.id === value);
}

export function providerCategoryHref(category: ProviderCategory | ProviderCategoryId) {
  const id = typeof category === "string" ? category : category.id;
  return id === "all" ? "/providers" : `/providers/${id}`;
}

export function providerMatchesCategory(item: DiscoveryItem, category: ProviderCategory | ProviderCategoryId) {
  const selected = typeof category === "string" ? getProviderCategory(category) : category;
  if (!selected || selected.id === "all") return true;
  const assigned = providerCategoryAssignments[item.id];
  if (assigned) return assigned.includes(selected.id);
  const text = `${item.name} ${(item.searchTerms || []).join(" ")} ${item.area} ${item.description} ${item.features.join(" ")}`.toLocaleLowerCase("he");
  return selected.tokens.some((token) => text.includes(token.toLocaleLowerCase("he")));
}
