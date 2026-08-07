import type { DiscoveryItem } from "./world-data";

export type HourlyDetails = {
  about: string[];
  stayOptions: { title: string; description: string }[];
  rates: { duration: string; price: string }[];
  amenities: string[];
  arrivalNotes: string[];
  faq: { question: string; answer: string }[];
};

const verifiedHourlyRates: Record<string, HourlyDetails["rates"]> = {
  "gentleman-haifa": [{ duration: "שעה", price: "200 ₪" }, { duration: "שעתיים", price: "250 ₪" }, { duration: "3 שעות", price: "300 ₪" }, { duration: "לילה", price: "650 ₪" }],
  "lago-suite": [{ duration: "שעה", price: "250 ₪" }, { duration: "שעתיים", price: "250 ₪" }, { duration: "3 שעות", price: "300 ₪" }, { duration: "לילה", price: "450 ₪" }],
  "kinki-rooms": [{ duration: "שעה", price: "330 ₪" }, { duration: "שעתיים", price: "330 ₪" }, { duration: "3 שעות", price: "370 ₪" }, { duration: "לילה", price: "700 ₪" }],
  "escape-love": [{ duration: "שעה", price: "200 ₪" }, { duration: "שעתיים", price: "200 ₪" }, { duration: "3 שעות", price: "250 ₪" }, { duration: "לילה", price: "450 ₪" }],
  "pninat-miel": [{ duration: "שעה", price: "300 ₪" }, { duration: "שעתיים", price: "300 ₪" }, { duration: "3 שעות", price: "300 ₪" }, { duration: "לילה", price: "600 ₪" }],
  "shanti-suites": [{ duration: "שעה", price: "200 ₪" }, { duration: "שעתיים", price: "200 ₪" }, { duration: "3 שעות", price: "250 ₪" }, { duration: "לילה", price: "400 ₪" }],
  "ahava-beshnaim": [{ duration: "שעה", price: "300 ₪" }, { duration: "שעתיים", price: "300 ₪" }, { duration: "3 שעות", price: "400 ₪" }, { duration: "לילה", price: "800 ₪" }],
  "herzliya-suite": [{ duration: "שעה", price: "400 ₪" }, { duration: "שעתיים", price: "400 ₪" }, { duration: "3 שעות", price: "400 ₪" }, { duration: "לילה", price: "650 ₪" }],
  "graf-suites": [{ duration: "שעה", price: "180 ₪" }, { duration: "שעתיים", price: "230 ₪" }, { duration: "3 שעות", price: "270 ₪" }, { duration: "לילה", price: "500 ₪" }],
  "titanic-spa": [{ duration: "שעה", price: "120 ₪" }, { duration: "שעתיים", price: "120 ₪" }, { duration: "3 שעות", price: "170 ₪" }],
};

export function getHourlyDetails(item: DiscoveryItem): HourlyDetails {
  const placeName = item.name;
  const location = item.location;
  return {
    about: [
      `${placeName} הוא מקום אירוח ב${location} לשהייה קצרה ודיסקרטית. בוחרים את משך השהייה, רואים את המחיר הידוע ומחייגים ישירות למקום לבדיקת שעה פנויה.`,
      `${item.description} השיחה עם המקום קצרה וממוקדת: מאשרים שעה, משך, סוג חדר ומחיר. אין תשלום באתר ואין טופס ארוך.`,
    ],
    stayOptions: [
      { title: "שהייה של שעה עד שלוש", description: "בוחרים משך ומחייגים כדי לקבל אישור מיידי לשעה הרצויה ולחדר הפנוי." },
      { title: "לילה או זמן ארוך יותר", description: "כאשר המקום מציע לינה, המחיר ושעות הכניסה והיציאה נסגרים ישירות בשיחה." },
    ],
    rates: verifiedHourlyRates[item.id] || [{ duration: "שעה", price: item.priceLabel || "מחיר בשיחה" }],
    amenities: item.features,
    arrivalNotes: [
      "הכתובת המדויקת והנחיות הכניסה נמסרות לאחר אישור ההזמנה.",
      "בשיחה מציינים שעה רצויה, משך שהייה וכל בקשה מיוחדת.",
      "התמונות מתארות את המקום, אך החדר הספציפי נקבע לפי המלאי הזמין בעת האישור.",
      "אופן התשלום, מדיניות הביטול והנחיות הכניסה נמסרים ישירות על ידי המקום.",
    ],
    faq: [
      { question: "איך יודעים אם יש חדר פנוי?", answer: "מחייגים למקום ומציינים שעה ומשך. בעל המקום או מרכז ההזמנות מאשרים מיד איזה חדר פנוי ומה המחיר." },
      { question: "האם המחיר המוצג הוא המחיר הסופי?", answer: "זהו מחיר התחלה כאשר הוא מופיע. המחיר הסופי תלוי במשך השהייה, ביום, בשעה ובחדר שנבחר." },
      { question: "אפשר לבקש כניסה עצמאית?", answer: `אם ${placeName} מציע כניסה עצמאית, ההנחיות נמסרות לאחר האישור. כאשר האפשרות אינה מצוינת, הצוות בודק אותה מול המקום.` },
      { question: "מה כדאי לומר בשיחה?", answer: "מציינים שעה רצויה, מספר שעות ומספר אורחים. אם חשובה כניסה ללא מפגש, חניה פרטית או חדר מסוים, מבקשים לאשר זאת בשיחה." },
    ],
  };
}
