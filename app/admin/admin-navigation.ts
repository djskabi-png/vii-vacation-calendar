import { BarChart3, BrainCircuit, Building2, CalendarSync, ExternalLink, FileSearch, Gauge, LibraryBig, ListChecks, MapPinned, MessageCircle, Route, Search, ShieldCheck, Sparkles, Star, TrendingUp } from "lucide-react";

export const adminNavigationGroups = [
  { label: "מרכז שליטה", links: [
    { href: "/admin", label: "תמונת מצב", hint: "מדדים, בריאות המערכת וסדר היום", icon: Gauge },
    { href: "/admin/growth", label: "מרכז קידום", hint: "SEO, מפות אתר, מדידה ותוכן", icon: Sparkles },
    { href: "/admin/search-pages", label: "מרכז עמודי חיפוש", hint: "עריכה, תזמון ופרסום", icon: FileSearch },
    { href: "/admin/business-performance", label: "ביצועי עסקים", hint: "חשיפות, כניסות ופעולות", icon: BarChart3 },
    { href: "/admin/professor", label: "שאל את פרופסור", hint: "שאלות על נתוני הניהול", icon: BrainCircuit },
    { href: "/admin/quality", label: "איכות ויציבות", hint: "בדיקות לפי עולם ורכיב, תקלות והיסטוריית ריצות", icon: ShieldCheck },
  ] },
  { label: "תוכן וגילוי", links: [
    { href: "/admin/content-studio", label: "סטודיו תוכן", hint: "כל העולמות, מגזין, תפריטים ופוטר", icon: LibraryBig },
    { href: "/admin/worlds", label: "הפעלת עולמות", hint: "הגדרת העולמות שמופיעים באתר", icon: Sparkles },
    { href: "/admin/search-analytics", label: "מודיעין חיפושים", hint: "ביקוש, אזורים ואפס תוצאות", icon: Search },
    { href: "/admin/content-queue", label: "תור אישורים", hint: "עמודים שנוצרו מביקוש אמיתי", icon: ListChecks },
    { href: "/admin/discovery-promotions", label: "קידום מקומות", hint: "טיוטות וקידום מבוקר", icon: TrendingUp },
    { href: "/admin/redirects", label: "כתובות והפניות", hint: "301, 410 ובקרת כתובות", icon: Route },
  ] },
  { label: "תפעול", links: [
    { href: "/admin/catalog-sync", label: "קטלוגים וספקים", hint: "משיכות, אבחון ושמירת דור תקין", icon: CalendarSync },
    { href: "/admin/geography", label: "ערים ואזורים", hint: "נתוני API, שמות, כתובות, מפה ונראות באתר", icon: MapPinned },
    { href: "/admin/operations", label: "הזמנות וחוות דעת", hint: "פעולות, סטטוסים ואסמכתאות", icon: Star },
    { href: "/admin/whatsapp-leads", label: "פניות וואטסאפ", hint: "פניות שנשמרו במערכת", icon: MessageCircle },
    { href: "/admin/users", label: "משתמשים והרשאות", hint: "גישה, תחומי עבודה וביטול הרשאות", icon: Building2 },
  ] },
];

export const adminCommands = adminNavigationGroups.flatMap(group => group.links.map(({ label, ...entry }) => ({ ...entry, title: label })));
