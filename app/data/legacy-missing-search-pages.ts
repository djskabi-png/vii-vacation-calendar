import type { SearchWorld } from "../lib/search-analytics.ts";

/**
 * Legacy search URLs found in the authoritative sitemap but absent from the
 * exported publication snapshot. These are explicit, reviewed intents, not
 * a fallback for arbitrary query strings.
 */
export const legacyMissingSearchPages = [
  {
    id: "legacy-even-menahem-15220",
    legacySourcePath: "/s/even_menahem/15220",
    sourcePath: "/search?location=%D7%90%D7%91%D7%9F+%D7%9E%D7%A0%D7%97%D7%9D&features=private-pool%2Ccovered-heated-pool%2Cheated-pool",
    location: "אבן מנחם",
    filters: { features: "private-pool,covered-heated-pool,heated-pool" },
    slug: "even-menahem-15220-private-covered-heated-pool",
    title: "נופש באבן מנחם עם בריכת שחייה פרטית מחוממת ומקורה",
    metaTitle: "נופש באבן מנחם עם בריכה פרטית מחוממת ומקורה",
    metaDescription: "מקומות נופש באבן מנחם עם בריכת שחייה פרטית מחוממת ומקורה.",
    h1: "נופש באבן מנחם עם בריכת שחייה פרטית מחוממת ומקורה",
    summary: "מקומות נופש באבן מנחם עם בריכת שחייה פרטית מחוממת ומקורה.",
    canonicalPath: "/search/vacations/even-menahem-15220-private-covered-heated-pool",
    latestResultCount: 0,
    body: "בריכה פרטית, מחוממת ומקורה מאפשרת לשלב שחייה בחופשה באבן מנחם גם כשקריר בחוץ. כאן מרוכזים מקומות שמסומנים בכל שלושת המאפיינים, לצד פרטי היחידות, התמונות והרכב האורחים המתאים.",
    faq: [{ question: "מה כולל הסינון בעמוד?", answer: "הסינון משלב מיקום באבן מנחם עם בריכה פרטית, מחוממת ומקורה." }],
    updatedAt: "2026-11-06T20:26:57.140Z",
    fallbackMode: "nearby" as const,
  },
  {
    id: "legacy-israel-178087",
    legacySourcePath: "/s/israel/178087",
    sourcePath: "/search?features=couples",
    location: "כל הארץ",
    filters: { features: "couples" },
    slug: "israel-178087-valentines-day",
    title: "מתחמי נופש ליום האהבה",
    metaTitle: "מתחמי נופש ליום האהבה",
    metaDescription: "מתחמי נופש רומנטיים ליום האהבה ברחבי הארץ.",
    h1: "מתחמי נופש ליום האהבה",
    summary: "מתחמי נופש רומנטיים ליום האהבה ברחבי הארץ.",
    canonicalPath: "/search/vacations/israel-178087-valentines-day",
    latestResultCount: 0,
    body: "חופשה זוגית ליום האהבה מתחילה בבחירת מקום שמתאים לשניכם. אפשר להשוות צימרים, סוויטות ומקומות אירוח לזוגות ברחבי הארץ, לעיין בגלריות ולצמצם לפי האזור והמתקנים שחשובים לכם.",
    faq: [{ question: "איך ממקדים את החיפוש לזוג?", answer: "העמוד מציג מקומות המתאימים לזוגות. אפשר להוסיף אזור, תאריכים ומאפיינים באמצעות סרגל החיפוש והמסננים." }],
    updatedAt: "2026-11-06T20:26:57.140Z",
    fallbackMode: "nearby" as const,
  },
] satisfies ReadonlyArray<Record<string, unknown> & { id: string; canonicalPath: string }>;

export const legacyMissingSearchWorld: SearchWorld = "vacation";
