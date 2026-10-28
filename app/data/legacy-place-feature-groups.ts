import type { ListingFeatureGroup } from "./site-data";
import migrated from "./legacy-place-feature-groups.json" with { type: "json" };

// Verified parity data from the former public place pages. The live supplier
// taxonomy remains authoritative whenever it contains groups; this overlay is
// only used for accepted snapshots that predate grouped shared amenities.
const verifiedOverrides: Record<string, ListingFeatureGroup[]> = {
  "vacation-2210": [
    { title: "מידע", items: ["עד 14 אורחים ללינה", "4 חדרי שינה", "2 חדרי רחצה"] },
    { title: "כללי", items: ["חניה פרטית", "יוקרתית", "מפואר"] },
    { title: "מתחם חיצוני", items: ["בריכת שחייה פרטית", "פינות שיזוף", "ריהוט גן חיצוני", "פינת ישיבה", "פינת מנגל", "חצר 200 מ״ר"] },
    { title: "מתחם פנימי", items: ["מטבח מאובזר", "מזגן", "מסך LCD", "WIFI", "פינת אוכל", "מרפסת נוף", "מכונת כביסה", "מייבש כביסה", "מערכת ישיבה", "סלון מעוצב"] },
    { title: "קהל יעד", items: ["משפחות", "זוגות", "ימי כיף", "ימי הולדת", "ציבור דתי", "שבתות חתן", "קבוצות", "אירועי חברה"] },
    { title: "מטבח מאובזר", items: ["כיריים גז", "מיקרוגל", "תנור אפייה", "מקרר", "מקפיא", "מדיח כלים", "פינת קפה"] },
    { title: "חדרי הרחצה", items: ["מקלחון", "מגבות רחצה", "סבונים"] },
    { title: "לציבור הדתי", items: ["פלטה", "מיחם"] },
    { title: "במיוחד לילדים", items: ["נדנדות"] },
    { title: "ניתן להזמין", items: ["ארוחת בוקר מפנקת", "ארוחות כשרות", "ארוחות צהריים", "ארוחות ערב"] },
  ],
};

export function legacyPlaceFeatureGroups(slug: string) {
  const groups = verifiedOverrides[slug] || (migrated.groups as Record<string, ListingFeatureGroup[]>)[slug];
  return groups?.map((group) => ({ ...group, items: [...group.items] }));
}
