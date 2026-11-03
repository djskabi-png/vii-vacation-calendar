export type CuratedVacationSearchPage = {
  id: string;
  legacySourcePath: string;
  sourcePath: string;
  editPath: string;
  location: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  summary: string;
  body: string;
  faq: Array<{ question: string; answer: string }>;
  canonicalPath: string;
  latestResultCount: number;
  updatedAt: string;
  filters: Record<string, string | number | boolean>;
  fallbackMode: "nearby";
};

export const curatedVacationSearchPages: CuratedVacationSearchPage[] = [
  {
    id: "curated-vacations-north-with-pool",
    legacySourcePath: "/vacations/north?pool=1",
    sourcePath: "/vacations/north?pool=1",
    editPath: "/vacations/north",
    location: "צפון",
    slug: "north-with-pool",
    title: "נופש בצפון עם בריכה",
    metaTitle: "נופש בצפון עם בריכה | מקומות אירוח בצפון",
    metaDescription: "מקומות נופש בצפון עם בריכה למשפחות, לזוגות ולקבוצות. השוו סידורי לינה, מאפייני בריכה, מחיר וזמינות ובחרו מקום שמתאים לחופשה שלכם.",
    h1: "נופש בצפון עם בריכה",
    summary: "ריכזנו מקומות נופש בצפון שמציגים בריכה במפרט המקום, כדי שתוכלו להשוות בין אפשרויות האירוח ולבחור את המקום שמתאים להרכב ולסגנון החופשה שלכם.",
    body: "נופש בצפון עם בריכה יכול להתאים למשפחות, לזוגות ולקבוצות שרוצים לשלב חופשה באזור עם זמן במים. בעמוד מופיעים מקומות אירוח מסוגים שונים, ולכן כדאי להשוות ביניהם לפי המיקום, מספר האורחים, חדרי השינה, סידורי הלינה והמתקנים.\n\nלפני שבוחרים מקום, פתחו את כרטיס האירוח ובדקו אם הבריכה פרטית או משותפת, האם היא מחוממת או מקורה, מהן שעות השימוש ואילו אמצעי בטיחות קיימים. מאפייני הבריכה משתנים ממקום למקום, ולכן חשוב לאמת את הפרטים הרלוונטיים לחופשה שלכם.\n\nהמחיר והזמינות משתנים לפי התאריכים, מספר הלילות, הרכב האורחים וסוג מקום האירוח. בחרו תאריכים כדי לקבל מידע עדכני כאשר המקום מנהל זמינות ומחיר אונליין. במקומות שאינם מנהלים יומן אונליין אפשר לפנות ישירות בטלפון או בוואטסאפ ולבדוק זמינות, מחיר ותנאי הזמנה.",
    faq: [
      {
        question: "האם בכל מקום נופש בצפון הבריכה פרטית?",
        answer: "לא. יש מקומות עם בריכה פרטית ויש מקומות עם בריכה משותפת. המידע מופיע בכרטיס המקום, ומומלץ לאמת אותו לפני ההזמנה."
      },
      {
        question: "איך בודקים אם הבריכה מחוממת או מקורה?",
        answer: "פתחו את פרטי המקום ובדקו את מאפייני הבריכה. אם חימום או קירוי חשובים לכם, אשרו שהם פעילים בתאריכים המבוקשים."
      },
      {
        question: "מה משפיע על המחיר של נופש בצפון עם בריכה?",
        answer: "המחיר מושפע מסוג מקום האירוח, התאריכים, מספר הלילות, מספר האורחים, רמת הפרטיות והמתקנים הכלולים."
      }
    ],
    canonicalPath: "/search/vacations/north-with-pool",
    latestResultCount: 0,
    updatedAt: "2026-11-03T18:00:00.000Z",
    filters: { features: "pool" },
    fallbackMode: "nearby"
  }
];
