export type WorldId = "vacation" | "events" | "corporate" | "spa" | "hourly" | "providers" | "activities";

export type WorldDefinition = {
  id: WorldId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
};

export const worlds: WorldDefinition[] = [
  { id: "vacation", label: "עולם הנופש", shortLabel: "נופש", description: "וילות, סוויטות ומקומות אירוח", href: "/" },
  { id: "events", label: "עולם האירועים", shortLabel: "אירועים", description: "לופטים ומתחמים לכל חגיגה", href: "/events" },
  { id: "corporate", label: "אירועי חברה ורווחה", shortLabel: "חברות", description: "ימי גיבוש, רווחה וחבילות מלאות לארגונים", href: "/corporate" },
  { id: "spa", label: "עולם הספא", shortLabel: "ספא", description: "טיפולים, חבילות וימי פינוק", href: "/spas" },
  { id: "hourly", label: "חדרים לכמה שעות", shortLabel: "לפי שעה", description: "שהייה קצרה, פרטית וגמישה", href: "/hourly" },
  { id: "providers", label: "עולם הספקים", shortLabel: "ספקים", description: "שפים, תקליטנים ותוכן לאירוח", href: "/providers" },
  { id: "activities", label: "אטרקציות", shortLabel: "אטרקציות", description: "אטרקציות וחוויות פעילות עם מידע מאומת", href: "/attractions" },
];

export const publicWorldNavigation = [
  ...worlds.filter((world) => world.id !== "activities"),
  { id: "trails", label: "מסלולי טיול", shortLabel: "מסלולים", description: "מסלולים עצמאיים לפי אזור, טבע ורמת קושי", href: "/trails" },
  { id: "attractions", label: "אטרקציות", shortLabel: "אטרקציות", description: "אטרקציות פעילות עם מידע מאומת ואפשרויות הזמנה", href: "/attractions" },
] as const;
