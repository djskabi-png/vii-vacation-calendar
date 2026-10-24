export const homepageContentInventory = [
  { id: "hero", label: "אזור פתיחה וחיפוש", owner: "טקסט מערכת מתורגם + רכיב החיפוש", mode: "platform" },
  { id: "popular", label: "חיפושים פופולריים", owner: "עמוד הבית במרכז התוכן", mode: "managed" },
  { id: "availability", label: "זמינות קרובה", owner: "לשוניות עמוד הבית + נתוני ספק", mode: "managed-live" },
  { id: "holidays", label: "נופש בחגים", owner: "לשוניות חגים + נתוני ספק", mode: "managed-live" },
  { id: "vacation-discovery", label: "יעדי נופש וסוגי מקומות", owner: "עמוד הבית במרכז התוכן", mode: "managed" },
  { id: "videos", label: "סרטונים מובילים", owner: "מדיה מאומתת של מקומות", mode: "live" },
  { id: "hourly", label: "חדרים לפי שעה", owner: "קטלוג ספק + מתג עולם", mode: "live" },
  { id: "events", label: "אירועים קרובים ועולם האירועים", owner: "קטלוג ספק + מתג עולם", mode: "live" },
  { id: "worlds", label: "המשך לכל העולמות", owner: "תפריטים + מתגי עולמות", mode: "managed-live" },
  { id: "ratings", label: "חוות דעת מובילות", owner: "חוות דעת וציוני ספק", mode: "live" },
  { id: "gift-corporate", label: "גיפט קארד וארגונים", owner: "עמודי היעד + מתג עולם ארגוני", mode: "managed-live" },
  { id: "destinations", label: "יעדים", owner: "קטלוג היעדים", mode: "live" },
  { id: "magazine", label: "מגזין", owner: "פריטי מגזין במרכז התוכן", mode: "managed" },
  { id: "trails", label: "מסלולים", owner: "פריטי טיולים במרכז התוכן", mode: "managed" },
] as const;

export type HomepageInventoryMode = typeof homepageContentInventory[number]["mode"];
