import verifiedCatalog from "./verified-catalog.json";

export type Listing = {
  slug: string;
  active?: boolean;
  name: string;
  location: string;
  area: string;
  type: string;
  units?: number;
  guests: number;
  bedrooms?: number;
  image: string;
  images: string[];
  description: string;
  features: string[];
  highlights?: ListingHighlight[];
  featureGroups?: ListingFeatureGroup[];
  audiences: string[];
  badges: string[];
  lat: number;
  lng: number;
  scenario: "single" | "multi";
  score?: number;
  reviews?: number;
  price?: number;
  roomOptions?: StayOption[];
  sleepingArrangements?: SleepingArrangement[];
  videos?: ListingVideo[];
  contact?: ListingContact;
  offerings?: BusinessOffering[];
};

export type BusinessWorld = "vacation" | "events" | "hourly" | "spa";

export type BusinessOffering = {
  world: BusinessWorld;
  label: string;
  summary: string;
  bookingMode: "availability-check" | "inquiry" | "instant-book" | "call-only" | "online-or-call";
  eventTypes?: string[];
  maxGuests?: number;
  minimumNights?: number;
  minimumHours?: number;
};

export function getListingOfferings(listing: Listing): BusinessOffering[] {
  return listing.offerings?.length ? listing.offerings : [{
    world: "vacation",
    label: "נופש ולינה",
    summary: "בוחרים תאריכי הגעה ועזיבה והרכב אורחים.",
    bookingMode: "availability-check",
    maxGuests: listing.guests,
  }];
}

export type ListingVideo = {
  title: string;
  src: string;
  poster: string;
  note: string;
};

export type ListingContact = {
  phone?: string;
  whatsapp?: string;
};

export type StayOption = {
  name: string;
  quantity: number;
  guests: number;
  bedrooms: number;
  area?: number;
  image: string;
  features: string[];
  highlights?: ListingHighlight[];
  featureGroups?: ListingFeatureGroup[];
};

export type ListingHighlightIcon = "units" | "pool" | "spa" | "games" | "garden" | "kitchen" | "view" | "parking" | "accessibility" | "events" | "default";

export type ListingHighlight = {
  label: string;
  icon: ListingHighlightIcon;
};

export type ListingFeatureGroup = {
  title: string;
  items: string[];
};

export type SleepingArrangement = {
  name: string;
  floor?: string;
  beds: Array<{ type: string; count: number }>;
  amenities: string[];
  galleryImage: string;
};

export type Property = Listing;

const commonVacationFaq = [
  { question: "איך בודקים זמינות?", answer: "בוחרים תאריכים והרכב אורחים. בשלב החיבור למערכת הניהול תוצג זמינות חיה לכל מקום ולכל יחידה." },
  { question: "האם המיקום במפה מדויק?", answer: "המפה מבוססת על נקודת המיקום שנמסרה עבור המקום. לפני ההגעה יוצגו פרטי הניווט המלאים." },
  { question: "איפה רואים מחיר סופי?", answer: "המחיר הסופי תלוי בתאריכים, בהרכב וביחידות שנבחרו. הוא יוצג לאחר חיבור מנוע ההזמנות הקיים." },
];

export const propertyFaq = commonVacationFaq;

const propertyCatalog: Property[] = [
  {
    slug: "aqua-resort",
    name: "אקווה ריזורט, וילת החוף",
    location: "אילת",
    area: "אילת והערבה",
    type: "וילה",
    guests: 14,
    bedrooms: 5,
    image: "/media/322de460abbda5c6.jpg",
    images: ["/media/322de460abbda5c6.jpg", "/media/e9cd942a11518461.jpg", "/media/ab778a6145517591.jpg", "/media/26594117388c096a.jpg", "/media/1f3375e65f593e58.jpg"],
    videos: [{ title: "סיור חזותי בוילה", src: "/media/tours/aqua-resort-tour.mp4", poster: "/media/322de460abbda5c6.jpg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "וילה יוקרתית באילת עם חמישה חדרי שינה, בריכת חוף פרטית ונוף לים סוף ולהרי אדום. המקום מתאים לעד 14 אורחים.",
    features: ["בריכת חוף פרטית", "נוף לים", "מטבח מאובזר", "חניה", "מיזוג אוויר"],
    highlights: [
      { label: "בריכת חוף פרטית", icon: "pool" },
      { label: "נוף לים", icon: "view" },
      { label: "מטבח מאובזר", icon: "kitchen" },
      { label: "חניה", icon: "parking" },
      { label: "מיזוג אוויר", icon: "default" },
    ],
    audiences: ["משפחות", "קבוצות", "זוגות"],
    badges: ["קרוב לים", "מקום אירוח שלם"],
    lat: 29.545042,
    lng: 34.9440222,
    scenario: "single",    contact: { phone: "055-4500077", whatsapp: "054-4285059" },
    roomOptions: [
      {
        name: "אקווה ריזורט, וילת החוף",
        quantity: 1,
        guests: 14,
        bedrooms: 5,
        image: "/media/06dee51033f85b91.jpg",
        features: ["בריכת שחייה פרטית", "מטבח מאובזר", "סלון משותף", "חניה פרטית", "חדרי רחצה"],
      },
    ],
  },
  {
    slug: "kesem-harimon",
    name: "קסם הרימון",
    location: "עזריקם",
    area: "מישור החוף הדרומי",
    type: "מתחם סוויטות",
    units: 4,
    guests: 14,
    bedrooms: 4,
    image: "/media/978e5fd5134b0831.jpeg",
    images: ["/media/978e5fd5134b0831.jpeg", "/media/25a3797914ce4ebc.jpeg", "/media/3d2467d61af8c746.jpeg", "/media/63392bf513efc0d8.jpeg", "/media/263f3613d9d7e1ac.jpeg"],
    videos: [{ title: "סיור חזותי במתחם", src: "/media/tours/kesem-harimon-tour.mp4", poster: "/media/978e5fd5134b0831.jpeg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "מתחם נופש במושב עזריקם עם ארבע סוויטות, בריכת שחייה, ג'קוזי ספא ומשחקי שולחן. מתאים לעד 14 אורחים.",
    features: ["בריכת שחייה", "ג'קוזי ספא", "משחקי שולחן", "מטבח מאובזר", "מתחם חוץ"],
    audiences: ["משפחות", "קבוצות", "זוגות"],
    badges: ["ארבע סוויטות", "מתאים לקבוצות"],
    lat: 31.7492396,
    lng: 34.7048635,
    scenario: "multi",    contact: { phone: "055-4538035", whatsapp: "058-4205153" },
    roomOptions: [
      { name: "יחידת סטודיו שני", quantity: 1, guests: 4, bedrooms: 1, area: 40, image: "/media/344593be613165a0.jpeg", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "מרפסת", "מיזוג אוויר"] },
      { name: "יחידת סטודיו העמק", quantity: 1, guests: 2, bedrooms: 1, area: 20, image: "/media/2675a888f1b78ca5.jpeg", features: ["מיטה זוגית", "מטבחון מאובזר", "מרפסת", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטה משפחתית וואנדרפול", quantity: 1, guests: 5, bedrooms: 1, area: 65, image: "/media/97ba60fbc7d797d4.jpeg", features: ["ג'קוזי זוגי", "מטבחון מאובזר", "סלון", "מרפסת", "יציאה לחצר"] },
      { name: "יחידת עכו", quantity: 1, guests: 3, bedrooms: 1, area: 20, image: "/media/3b0cd23d3dc1c2d5.jpeg", features: ["מיטה זוגית", "מטבחון", "פינת אוכל", "מיזוג אוויר", "חדר רחצה פרטי"] },
    ],
  },
  {
    slug: "ahuzat-or",
    name: "אחוזת האור",
    location: "כלנית",
    area: "סובב כנרת",
    type: "מתחם סוויטות",
    units: 3,
    guests: 12,
    bedrooms: 3,
    image: "/media/9a403cb4d9d1cbde.jpg",
    images: ["/media/9a403cb4d9d1cbde.jpg", "/media/27ea67354de7adf5.jpg", "/media/46795433029f635b.jpg", "/media/f2c974e4edc6e951.jpg", "/media/39a22ff22e8130b5.jpg"],
    videos: [{ title: "סיור חזותי באחוזה", src: "/media/tours/ahuzat-or-tour.mp4", poster: "/media/9a403cb4d9d1cbde.jpg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "שלוש סוויטות יוקרתיות בכלנית עם בריכת שחייה, ג'קוזי זוגי בכל סוויטה, משחקי שולחן ואבזור מלא. המתחם מתאים לעד 12 אורחים.",
    features: ["בריכת שחייה", "ג'קוזי בכל סוויטה", "משחקי שולחן", "מטבחון", "נוף"],
    audiences: ["משפחות", "זוגות", "קבוצות קטנות"],
    badges: ["ליד הכנרת", "שלוש סוויטות"],
    lat: 32.875043,
    lng: 35.4536474,
    scenario: "multi",    contact: { phone: "052-9170990", whatsapp: "050-7780463" },
    roomOptions: [
      { name: "סוויטות 1+2", quantity: 2, guests: 3, bedrooms: 1, image: "/media/bd2014647cb58169.jpg", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "מרפסת", "חדר רחצה פרטי"] },
      { name: "סוויטה משפחתית", quantity: 1, guests: 6, bedrooms: 1, image: "/media/e5857ed7c9141736.jpg", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "פינת אוכל", "חדר רחצה פרטי"] },
    ],
  },
  {
    slug: "ar-suites",
    active: false,
    name: "א.ר סוויטות",
    location: "אילת",
    area: "אילת והערבה",
    type: "דירת נופש",
    units: 1,
    guests: 7,
    bedrooms: 2,
    image: "/media/c3a6274bfd08091a.jpeg",
    images: ["/media/c3a6274bfd08091a.jpeg", "/media/cfbaafcf99fd6ec5.jpeg", "/media/b60283b7a634cd04.jpeg", "/media/fb2329f74cc92e55.jpeg", "/media/eab56144ac75965f.jpeg"],
    videos: [{ title: "סיור חזותי בדירה", src: "/media/tours/ar-suites-tour.mp4", poster: "/media/c3a6274bfd08091a.jpeg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "דירת נופש מעוצבת ומאובזרת באילת עם שני חדרי שינה, סלון, מטבח וחצר עם בריכת שחייה מחוממת. מתאימה לעד שבעה אורחים.",
    features: ["בריכה מחוממת", "מטבח מאובזר", "חצר פרטית", "סלון", "מיזוג אוויר"],
    audiences: ["משפחות", "זוגות"],
    badges: ["דירה שלמה", "בריכה מחוממת"],
    lat: 29.5526362,
    lng: 34.9480892,
    scenario: "single",    roomOptions: [
      { name: "א.ר סוויטות", quantity: 1, guests: 7, bedrooms: 2, image: "/media/88fcef4341b24a45.jpeg", features: ["בריכה מחוממת", "מטבח מאובזר", "סלון משותף", "חצר", "חניה פרטית"] },
    ],
  },
  {
    slug: "sol-gilgal",
    name: "סול, מתחם אירוח ואירועים",
    location: "גלגל",
    area: "בקעת הירדן",
    type: "מתחם סוויטות",
    units: 6,
    guests: 26,
    bedrooms: 8,
    image: "/media/bc85b10f1d64d6db.jpeg",
    images: ["/media/bc85b10f1d64d6db.jpeg", "/media/78fc8af7d313639d.jpeg", "/media/043d473d475768df.jpeg", "/media/9364ef10c919fddf.jpeg", "/media/24beed85986e4496.jpeg"],
    videos: [{ title: "סיור חזותי במתחם", src: "/media/tours/sol-gilgal-tour.mp4", poster: "/media/bc85b10f1d64d6db.jpeg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "מתחם אירוח בגלגל המשלב שש סוויטות, מרחבי חוץ ואפשרות לנופש או לאירוע. המתחם כולל שמונה חדרי שינה ומתאים לעד 26 אורחים.",
    features: ["בריכת שחייה", "גינה פרטית", "מדשאות", "פינת ישיבה", "מטבחון מאובזר"],
    audiences: ["משפחות", "קבוצות", "אירועים קטנים"],
    badges: ["שש סוויטות", "מתאים לקבוצות"],
    offerings: [
      {
        world: "vacation",
        label: "נופש ולינה",
        summary: "אירוח בשש סוויטות עם שמונה חדרי שינה לקבוצות ולמשפחות.",
        bookingMode: "availability-check",
        maxGuests: 26,
      },
      {
        world: "events",
        label: "אירועים קטנים",
        summary: "בדיקת התאמה לאירוע קטן במרחבי החוץ של המתחם.",
        bookingMode: "inquiry",
        eventTypes: ["אירוע קטן"],
        maxGuests: 26,
      },
    ],
    lat: 32.9086754,
    lng: 35.8009862,
    scenario: "multi",    contact: { phone: "055-4538181", whatsapp: "052-4477779" },
    roomOptions: [
      { name: "סוויטה 1", quantity: 1, guests: 8, bedrooms: 2, image: "/media/e5698c8d9c4f56a7.jpeg", features: ["בריכת שחייה", "גינה פרטית", "מטבחון מאובזר", "פינת ישיבה", "מיזוג אוויר"] },
      { name: "סוויטה 2", quantity: 1, guests: 6, bedrooms: 2, image: "/media/5c289de538268419.jpeg", features: ["ג'קוזי", "מרפסת", "מטבחון מאובזר", "מסכי טלוויזיה", "מיזוג אוויר"] },
      { name: "סוויטה 3", quantity: 1, guests: 4, bedrooms: 1, image: "/media/02badfa50d49f9e9.jpeg", features: ["ג'קוזי", "גינה פרטית", "מטבחון מאובזר", "ספה נפתחת", "חדר רחצה"] },
      { name: "סוויטה 4", quantity: 1, guests: 4, bedrooms: 1, image: "/media/7dfc166be82baf7b.jpeg", features: ["ג'קוזי זוגי", "בר חיצוני", "מטבחון מאובזר", "ספה נפתחת", "חדר רחצה פרטי"] },
      { name: "חדר שינה", quantity: 2, guests: 2, bedrooms: 1, image: "/media/d990887dc5a1b0d6.jpeg", features: ["מיטה זוגית", "מטבחון מאובזר", "מסך טלוויזיה", "מיזוג אוויר", "שידות אחסון"] },
    ],
  },
  {
    slug: "infinity-suites",
    active: false,
    name: "סוויטות אינסוף",
    location: "אביבים",
    area: "גליל עליון",
    type: "סוויטות",
    units: 2,
    guests: 10,
    bedrooms: 2,
    image: "/media/e65d757e686fda64.jpg",
    images: ["/media/e65d757e686fda64.jpg", "/media/4fa8dc0cb7d99d59.jpeg", "/media/96d6e3022986cdb8.jpeg", "/media/0c9f94d10a51d32c.jpeg", "/media/8e61695d7524a310.jpeg"],
    videos: [{ title: "סיור חזותי בסוויטות", src: "/media/tours/infinity-suites-tour.mp4", poster: "/media/e65d757e686fda64.jpg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "שתי סוויטות באביבים עם ג'קוזי ספא מחומם ומקורה, בריכה, מטבחונים, פינות ישיבה וקמין עצים. המתחם מתאים לעד עשרה אורחים.",
    features: ["בריכה", "ג'קוזי ספא", "קמין עצים", "מטבחון", "פינת מנגל"],
    audiences: ["זוגות", "משפחות"],
    badges: ["שתי סוויטות", "גליל עליון"],
    lat: 33.089381,
    lng: 35.470338,
    scenario: "multi",    roomOptions: [
      { name: "סוויטה 1", quantity: 1, guests: 6, bedrooms: 2, image: "/media/051ff4fbc8d7d2ac.jpeg", features: ["ג'קוזי זוגי", "ג'קוזי ספא", "מטבחון", "סלון", "חדר רחצה פרטי"] },
      { name: "סוויטה 2", quantity: 1, guests: 4, bedrooms: 1, image: "/media/992360940783149f.jpeg", features: ["בריכה מחוממת", "ג'קוזי ספא", "מטבחון מאובזר", "סלון", "חדר רחצה פרטי"] },
    ],
  },
  {
    slug: "magic-garden-gefen",
    name: "סוויטות הגן הקסום גפן",
    location: "גפן",
    area: "ירושלים והרי יהודה",
    type: "מתחם סוויטות",
    units: 4,
    guests: 20,
    bedrooms: 4,
    image: "/media/231b0e706cc61cc1.jpg",
    images: ["/media/231b0e706cc61cc1.jpg", "/media/fa2f2bbd00f4e98b.jpg", "/media/122679201a6d4958.jpg", "/media/7ce2e9ab4ab99755.jpg", "/media/58af829dd9a3a209.jpg"],
    videos: [{ title: "סיור חזותי בגן הקסום", src: "/media/tours/magic-garden-gefen-tour.mp4", poster: "/media/231b0e706cc61cc1.jpg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "מתחם פרטי במושב גפן עם ארבע סוויטות מאובזרות, בריכה מחוממת ומקורה, מטבח מרכזי ומשחקי שולחן. מתאים לעד 20 אורחים.",
    features: ["בריכה מחוממת ומקורה", "מטבח מרכזי", "משחקי שולחן", "מתחם פרטי", "חצר"],
    audiences: ["משפחות", "קבוצות"],
    badges: ["ארבע סוויטות", "בריכה מקורה"],
    lat: 31.7447,
    lng: 34.8796582,
    scenario: "multi",    contact: { phone: "055-4500620", whatsapp: "050-8534766" },
    roomOptions: [
      { name: "סוויטות הגן הקסום גפן", quantity: 4, guests: 5, bedrooms: 1, image: "/media/509e8deccde1f57b.jpg", features: ["בריכה מחוממת ומגודרת", "מטבח מאובזר", "מיזוג אוויר", "חדר אוכל", "חדר רחצה"] },
    ],
  },
  {
    slug: "anael-estate",
    name: "אחוזת אנאאל בגליל",
    location: "גליל עליון",
    area: "צפון",
    type: "סוויטות יוקרה",
    units: 6,
    guests: 23,
    bedrooms: 6,
    image: "/media/f18d7c0469633ca0.jpeg",
    images: ["/media/f18d7c0469633ca0.jpeg", "/media/8ac8a179f674fd0b.jpeg", "/media/e8bfa1908a5718a1.jpeg", "/media/7ec9bd469f615590.jpeg", "/media/98723ca0b7e64cb5.jpeg"],
    videos: [{ title: "סיור חזותי באחוזה", src: "/media/tours/anael-estate-tour.mp4", poster: "/media/f18d7c0469633ca0.jpeg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "שש סוויטות בוטיק בגליל העליון עם ג'קוזי פרטי, בריכה מגודרת, ספא, סאונה ומשחקים לכל המשפחה. המתחם מתאים לעד 23 אורחים.",
    features: ["בריכה מגודרת", "ג'קוזי פרטי", "ספא", "סאונה", "משחקים למשפחה"],
    audiences: ["משפחות", "זוגות", "קבוצות"],
    badges: ["שש סוויטות", "מתחם ספא"],
    lat: 33.0131356,
    lng: 35.4428227,
    scenario: "multi",    contact: { phone: "055-4500075", whatsapp: "050-4240966" },
    roomOptions: [
      { name: "סוויטת מירון", quantity: 1, guests: 4, bedrooms: 1, image: "/media/f464736f27f8fecc.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטת גאיה", quantity: 1, guests: 4, bedrooms: 1, image: "/media/60c5f363faf0e25c.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת אליה", quantity: 1, guests: 4, bedrooms: 1, image: "/media/39c757501576edbf.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת נועה", quantity: 1, guests: 4, bedrooms: 1, image: "/media/f5111ce0b04bae06.jpeg", features: ["מיטה זוגית", "ג'קוזי גדול", "מטבחון מאובזר", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטת יובל", quantity: 1, guests: 4, bedrooms: 1, image: "/media/79002afa5a5ea9f4.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת חרמון", quantity: 1, guests: 3, bedrooms: 1, image: "/media/59dfc90ef2b2d2b8.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
    ],
  },
  {
    slug: "perfumes-villa",
    name: "וילת הבשמים",
    location: "אילת",
    area: "אילת והערבה",
    type: "וילה",
    guests: 30,
    bedrooms: 9,
    image: "/media/69e3820a7e10bc39.jpeg",
    images: ["/media/69e3820a7e10bc39.jpeg", "/media/d0884a4074adf164.jpeg", "/media/17b60333b3f4b544.jpeg", "/media/13f80a1579a643a1.jpeg", "/media/422f8615ae7df2c6.jpeg"],
    videos: [
      { title: "סיור חזותי בוילה", src: "/media/tours/perfumes-villa-tour.mp4", poster: "/media/69e3820a7e10bc39.jpeg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." },
      { title: "סיור בחדרי השינה", src: "/media/tours/perfumes-villa-bedrooms.mp4", poster: "/media/7567d48a2013fbb4.jpeg", note: "הסיור נערך מתמונות חדרי השינה שנמסרו למקום ואינו צילום וידאו רציף." },
    ],
    description: "וילה באילת עם תשעה חדרי שינה, בריכת שחייה, נוף, סלון גדול ומטבח מאובזר. מתאימה לעד 30 אורחים.",
    features: ["בריכת שחייה", "נוף", "מטבח מאובזר", "סלון גדול", "מתאים לציבור הדתי"],
    audiences: ["משפחות", "קבוצות", "זוגות", "ציבור דתי"],
    badges: ["תשעה חדרים", "עד 30 אורחים"],
    lat: 29.539488,
    lng: 34.933483,
    scenario: "single",    contact: { phone: "055-4538221", whatsapp: "054-4233163" },
    roomOptions: [
      { name: "וילת הבשמים", quantity: 1, guests: 30, bedrooms: 9, image: "/media/a1bf446307213170.jpeg", features: ["בריכת שחייה", "מטבח מאובזר", "שני סלונים", "חניה פרטית", "תשעה חדרי שינה"] },
    ],
    sleepingArrangements: [
      { name: "חדר שינה 1", floor: "קומת הכניסה", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מטבחון", "סלון", "מסך טלוויזיה", "מיזוג אוויר", "אחסון", "חדר רחצה פרטי"], galleryImage: "/media/7567d48a2013fbb4.jpeg" },
      { name: "חדר שינה 2", floor: "קומת הכניסה", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מסך טלוויזיה", "מיזוג אוויר", "אחסון", "חדר רחצה פרטי"], galleryImage: "/media/2f7676f977ecf219.jpeg" },
      { name: "חדר שינה 3", floor: "קומת הכניסה", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מסך טלוויזיה", "מיזוג אוויר", "אחסון", "חדר רחצה פרטי"], galleryImage: "/media/c3ee9aa0fa56ea8e.jpeg" },
      { name: "חדר שינה 4", floor: "קומת הכניסה", beds: [{ type: "מיטת יחיד", count: 1 }], amenities: ["מיזוג אוויר"], galleryImage: "/media/f20cb9a07739bca1.jpeg" },
      { name: "חדר שינה 5", floor: "הקומה השנייה", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מסך טלוויזיה", "מיזוג אוויר", "אחסון", "שירותים"], galleryImage: "/media/1e1de19070a64e75.jpeg" },
      { name: "חדר שינה 6", floor: "הקומה השלישית", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מסך טלוויזיה", "מיזוג אוויר", "אחסון", "חדר רחצה פרטי"], galleryImage: "/media/a51703b37e470c27.jpeg" },
      { name: "חדר שינה 7", floor: "הקומה השלישית", beds: [{ type: "מיטה זוגית", count: 1 }], amenities: ["מסך טלוויזיה", "מיזוג אוויר", "אחסון", "חדר רחצה משותף"], galleryImage: "/media/b71298f91a04d2d7.jpeg" },
      { name: "חדר שינה 8", beds: [{ type: "מיטת יחיד", count: 2 }], amenities: ["מיזוג אוויר"], galleryImage: "/media/ba3670b131318b2d.jpeg" },
      { name: "חדר שינה 9", beds: [{ type: "מיטת יחיד", count: 2 }], amenities: ["מיזוג אוויר"], galleryImage: "/media/e5020496e30e7dc0.jpeg" },
    ],
  },
  {
    slug: "rose-estate",
    name: "אחוזת השושנים בוטיק",
    location: "שומרה",
    area: "גליל מערבי",
    type: "וילה",
    guests: 17,
    bedrooms: 5,
    image: "/media/cf58dc69af40c772.jpg",
    images: ["/media/cf58dc69af40c772.jpg", "/media/78ad6fb57aff8002.jpg", "/media/318cc18bc4802985.jpg", "/media/0893cb9de7ce9600.jpg", "/media/0654386871fb5427.jpg"],
    videos: [{ title: "סיור חזותי באחוזה", src: "/media/tours/rose-estate-tour.mp4", poster: "/media/cf58dc69af40c772.jpg", note: "הסיור נערך מתמונות המקום המאומתות ואינו צילום וידאו רציף." }],
    description: "וילת בוטיק בשומרה עם חמישה חדרי שינה, בריכה מחוממת ומקורה, ג'קוזי ספא, מטבח מאובזר ונוף גלילי. מתאימה לעד 17 אורחים.",
    features: ["בריכה מחוממת ומקורה", "ג'קוזי ספא", "מטבח מאובזר", "נוף גלילי", "משחקי שולחן"],
    audiences: ["משפחות", "זוגות", "קבוצות", "ציבור דתי"],
    badges: ["וילת בוטיק", "בריכה מקורה"],
    lat: 33.087485,
    lng: 35.288424,
    scenario: "single",    contact: { phone: "055-4538029", whatsapp: "050-3734051" },
    roomOptions: [
      { name: "אחוזת השושנים בוטיק", quantity: 1, guests: 17, bedrooms: 5, area: 200, image: "/media/2b59a771f32da043.jpg", features: ["בריכה מחוממת ומקורה", "ג'קוזי ספא", "מטבח מאובזר", "סלון משותף", "חמישה חדרי שינה"] },
    ],
  },
];

const activePropertyOrder = [
  "aqua-resort",
  "kesem-harimon",
  "ahuzat-or",
  "ar-suites",
  "sol-gilgal",
  "anael-estate",
  "magic-garden-gefen",
  "perfumes-villa",
  "rose-estate",
];

function readVerifiedCount(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  return match ? Number(match[1]) : undefined;
}

const verifiedProperties: Property[] = verifiedCatalog.vacation.map((item) => ({
  slug: item.id,
  name: item.name,
  location: item.location,
  area: item.area,
  type: "מתחם נופש",
  units: readVerifiedCount(item.location, /(\d+)\s*(?:יחידות|וילות|סוויטות)/),
  guests: item.guests,
  bedrooms: readVerifiedCount(item.location, /(\d+)\s*חדרים/),
  image: item.image,
  images: item.images,
  description: item.description,
  features: item.features,
  audiences: ["משפחות", "זוגות", "קבוצות"],
  badges: [item.area, "מידע ותמונות מאומתים"],
  lat: item.lat,
  lng: item.lng,
  scenario: "single",
  price: "price" in item && typeof item.price === "number" ? item.price : undefined,
}));

const unavailablePropertyImages = new Set([
  "/media/c3a6274bfd08091a.jpeg",
]);

export function isPublicProperty(property: Property) {
  return property.active !== false
    && Boolean(property.image)
    && (property.images?.filter(Boolean).length || 0) >= 3
    && !unavailablePropertyImages.has(property.image);
}

export const properties = [...propertyCatalog
  .filter(isPublicProperty)
  .sort((first, second) => activePropertyOrder.indexOf(first.slug) - activePropertyOrder.indexOf(second.slug)), ...verifiedProperties.filter(isPublicProperty)];

export type EventPlace = Listing & { eventTypes: string[]; sourcePropertySlug?: string };

const eventPlaceCatalog: EventPlace[] = [
  {
    slug: "party-time", active: false, name: "לופט פארטי טיים", location: "מצליח", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 40,
    image: "/media/95d6a4d598adae11.png",
    images: ["/media/95d6a4d598adae11.png", "/media/9f5b2efa71e5b42e.jpg", "/media/93e697d77ba82b00.jpg", "/media/cbb81d3949850f32.jpg", "/media/c549ced51085ea4c.jpeg"],
    description: "לופט למסיבות במושב מצליח עם בריכה, פינות ישיבה, ערסלים, מקרן, מערכת הגברה ותאורה וג'קוזי.",
    features: ["בריכה", "ג'קוזי", "מערכת הגברה", "תאורה", "מקרן"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["עד 40 אורחים"], lat: 31.906364, lng: 34.871278, scenario: "single",
  },
  {
    slug: "black-loft", name: "בלאק לופט", location: "נשר", area: "חיפה וחוף הכרמל", type: "לופט", units: 1, guests: 80,
    image: "/media/abedce80fe9387f0.jpg",
    images: ["/media/abedce80fe9387f0.jpg", "/media/99e8bf5556fac3f9.jpg", "/media/7d6f829a5b959d5e.jpg", "/media/5a65542fba432b43.jpg", "/media/970a6f624825689b.jpg"],
    description: "מתחם אירועים אורבני בנשר בשטח של כ־180 מ״ר, עם סנוקר, קריוקי, אפשרות לברביקיו וללא הגבלת רעש.",
    features: ["קריוקי", "סנוקר", "ברביקיו", "ללא הגבלת רעש", "חלל ממוזג"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["ללא הגבלת רעש", "עד 80 אורחים"], lat: 32.7729976, lng: 35.0464748, scenario: "single",
    contact: { phone: "055-4538062" },
  },
  {
    slug: "sani-loft", name: "סאני לופט", location: "פתח תקווה", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 1, guests: 300,
    image: "/media/e99934d4cd69ffab.jpg",
    images: ["/media/e99934d4cd69ffab.jpg", "/media/58eef66e02205183.jpeg", "/media/8e5aa2a9393823d0.jpg", "/media/17ede1ebcc475c64.jpeg", "/media/d85991c8219b91de.jpeg"],
    description: "מתחם אירועים בפתח תקווה לעד 300 אורחים עם חללים גמישים, בר מעוצב ומערכות סאונד ותאורה.",
    features: ["בר מעוצב", "מערכת סאונד", "תאורה", "חללים גמישים", "רחבת אירוח"], audiences: ["אירועים עסקיים", "אירועים משפחתיים", "מסיבות"], eventTypes: ["אירוע עסקי", "אירוע משפחתי", "מסיבה"], badges: ["עד 300 אורחים"], lat: 32.1074967, lng: 34.8938899, scenario: "single",
    contact: { phone: "055-4311082" },
  },
  {
    slug: "360-events", name: "360 איוונטס", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "לופט ומתחם אירועים", units: 2, guests: 200,
    image: "/media/22426b735d8911c2.jpeg",
    images: ["/media/22426b735d8911c2.jpeg", "/media/0487e823c3860fcf.jpeg", "/media/a2a28ff775cfffd2.jpeg", "/media/1e55af72515a767d.jpeg", "/media/c7e7d0ee7c7c901e.jpeg"],
    description: "שני מתחמי אירועים בראשון לציון, לופט מעוצב ואולם מאובזר, עם בריכה ומשחקי שולחן.",
    features: ["בריכה", "משחקי שולחן", "אולם מאובזר", "לופט", "מערכת הגברה"], audiences: ["אירועים פרטיים", "אירועים משפחתיים", "מסיבות"], eventTypes: ["אירוע פרטי", "אירוע משפחתי", "מסיבה"], badges: ["שני מתחמים", "עד 200 אורחים"], lat: 31.9949496, lng: 34.7670958, scenario: "multi",
    contact: { phone: "055-4317903" },
  },
  {
    slug: "loft-117", name: "לופט 117", location: "תל אביב", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 25, bedrooms: 2,
    image: "/media/d95f11f0ea7d4344.jpeg",
    images: ["/media/d95f11f0ea7d4344.jpeg", "/media/5a173c6b401c5af2.jpeg", "/media/96624d8114713a13.jpeg", "/media/3fa923fee3a0dc30.jpeg", "/media/c4a4aae70509df3c.jpeg"],
    description: "מתחם אירועים בתל אביב המתפרס על שלוש קומות, עם בריכה, ג'קוזי, סנוקר ומערכות הגברה, ללא הגבלת רעש.",
    features: ["בריכה", "ג'קוזי", "סנוקר", "מערכת הגברה", "ללא הגבלת רעש"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["שלוש קומות", "ללא הגבלת רעש"], lat: 32.0526142, lng: 34.770393, scenario: "single",
    contact: { phone: "055-4538052" },
  },
  {
    slug: "fiesta", name: "פיאסטה", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 1, guests: 150,
    image: "/media/c8636de988012cc4.jpeg",
    images: ["/media/c8636de988012cc4.jpeg", "/media/5a82326a61386b45.jpeg", "/media/8366852393eab999.jpeg", "/media/90ddf7b515627815.jpeg", "/media/b1e6fda847386469.jpeg"],
    description: "מתחם לאירועים ומסיבות בראשון לציון עם גג מעוצב, תאורה צבעונית, מערכת הגברה ומקרן.",
    features: ["גג מעוצב", "תאורה", "מערכת הגברה", "מקרן", "רחבת אירוח"], audiences: ["מסיבות", "אירועים פרטיים", "אירועים משפחתיים"], eventTypes: ["מסיבה", "אירוע פרטי", "אירוע משפחתי"], badges: ["עד 150 אורחים"], lat: 31.9899591, lng: 34.7696283, scenario: "single",
    contact: { phone: "055-4311895" },
  },
  {
    slug: "details-events", name: "דיטלס איוונטס", location: "אשקלון", area: "מישור החוף הדרומי", type: "לופט", units: 1, guests: 100,
    image: "/media/18209caf81f966b8.jpg",
    images: ["/media/18209caf81f966b8.jpg", "/media/1f58867599c627bf.jpg", "/media/276d5821c6777131.jpg", "/media/84fc178b319eb191.jpg", "/media/6bba3293d0b221ed.jpg"],
    description: "לופט באשקלון עם מתחם בריכה, אולם פנימי, מערכות שמע ושולחן סנוקר.",
    features: ["בריכה", "אולם פנימי", "מערכת שמע", "סנוקר", "פינת מנגל"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["עד 100 אורחים"], lat: 31.6677184, lng: 34.6058536, scenario: "single",
    contact: { phone: "055-4538170" },
  },
  {
    slug: "star-loft", name: "סטאר לופט", location: "נשר", area: "חיפה וחוף הכרמל", type: "לופט", units: 1, guests: 40,
    image: "/media/b62b6a8227f8e23b.jpeg",
    images: ["/media/b62b6a8227f8e23b.jpeg", "/media/502b9ca2d5f4aec8.jpeg", "/media/d8dc5d5538b6ac37.jpeg", "/media/87d6c10626118e48.jpeg", "/media/832c0f611aa813cd.jpeg"],
    description: "מתחם אירועי בוטיק בנשר בעיצוב אורבני, עם מערכות טכנולוגיות ואווירה אינטימית.",
    features: ["עיצוב אורבני", "מערכת הגברה", "תאורה", "חלל ממוזג", "אזור ישיבה"], audiences: ["מסיבות", "אירועים פרטיים", "ימי הולדת"], eventTypes: ["מסיבה", "אירוע פרטי", "יום הולדת"], badges: ["בוטיק", "עד 40 אורחים"], lat: 32.7748383, lng: 35.0417679, scenario: "single",
    contact: { phone: "055-4538033" },
  },
  {
    slug: "puzzle-club", name: "לופט מועדון הפאזל", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 100,
    image: "/media/34febbf88799991c.jpeg",
    images: ["/media/34febbf88799991c.jpeg", "/media/a5d44297328ad403.jpeg", "/media/482a8278970ca147.jpeg", "/media/0956f17abd969070.jpeg", "/media/63382bff0ff9f97c.jpeg"],
    description: "לופט בראשון לציון לאירועים של עד 100 אורחים, עם קריוקי, תאורה, הגברה ומשחקי שולחן, ללא הגבלת רעש.",
    features: ["קריוקי", "תאורה", "מערכת הגברה", "משחקי שולחן", "ללא הגבלת רעש"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["ללא הגבלת רעש", "עד 100 אורחים"], lat: 32.0507881, lng: 34.7698469, scenario: "single",
    contact: { phone: "055-4538006" },
  },
  {
    slug: "paphos-events", name: "פאפוס איוונטס", location: "רחובות", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 2, guests: 160,
    image: "/media/719f02294225cd35.jpeg",
    images: ["/media/719f02294225cd35.jpeg", "/media/d24662484ad86c4d.jpg", "/media/ed5adbe6f0cca1d8.jpg", "/media/a2048bcf0086ce92.jpeg", "/media/89d24c9d1f360675.jpg"],
    description: "שני מתחמי אירועים ברחובות עם חבילות אירוח מגוונות ואפשרות לאוכל, אלכוהול ובידור, ללא הגבלת רעש.",
    features: ["שני מתחמים", "ללא הגבלת רעש", "חבילות אירוח", "מערכת הגברה", "רחבת אירוח"], audiences: ["מסיבות", "אירועים פרטיים", "אירועים עסקיים"], eventTypes: ["מסיבה", "אירוע פרטי", "אירוע עסקי"], badges: ["שני מתחמים", "עד 160 אורחים"], lat: 31.8900148, lng: 34.780923, scenario: "multi",
    contact: { phone: "055-4538198" },
  },
];

const sharedEventPlaces: EventPlace[] = propertyCatalog.flatMap((listing) => {
  const eventOffering = getListingOfferings(listing).find((offering) => offering.world === "events");
  if (!eventOffering || listing.active === false) return [];
  return [{
    ...listing,
    eventTypes: eventOffering.eventTypes || [],
    sourcePropertySlug: listing.slug,
    ...(eventOffering.maxGuests ? { guests: eventOffering.maxGuests } : {}),
  }];
});

const verifiedEventPlaces: EventPlace[] = verifiedCatalog.events.map((item) => ({
  slug: item.id,
  name: item.name,
  location: item.location,
  area: item.area,
  type: "מתחם אירועים",
  guests: item.guests,
  image: item.image,
  images: item.images,
  description: item.description,
  features: item.features,
  audiences: ["אירועים פרטיים", "ימי הולדת", "אירועי חברה"],
  eventTypes: ["אירוע פרטי", "יום הולדת", "אירוע חברה"],
  badges: [item.area, `עד ${item.guests} אורחים`],
  lat: item.lat,
  lng: item.lng,
  scenario: "single",
  price: "price" in item && typeof item.price === "number" ? item.price : undefined,
}));

export const eventPlaces = [
  ...eventPlaceCatalog.filter(isPublicProperty),
  ...sharedEventPlaces.filter((shared) => isPublicProperty(shared) && !eventPlaceCatalog.some((place) => place.slug === shared.slug)),
  ...verifiedEventPlaces.filter(isPublicProperty),
];

export function eventPlaceHref(place: EventPlace) {
  return place.sourcePropertySlug
    ? `/business?id=${place.sourcePropertySlug}&mode=events`
    : `/events/place/${place.slug}`;
}

export const destinations = [
  { name: "אילת", subtitle: "ים, שמש ומקומות אירוח שלמים", image: properties[0].image },
  { name: "גליל עליון", subtitle: "נוף ירוק, סוויטות ומתחמי ספא", image: properties[5].image },
  { name: "סובב כנרת", subtitle: "חופשה רגועה ליד המים", image: properties[2].image },
  { name: "מישור החוף", subtitle: "חופשה קרובה בלי להתפשר", image: properties[1].image },
];

export const guides = [
  { title: "איך לבחור מקום שמתאים בדיוק להרכב", category: "תכנון חופשה", excerpt: "מיקום, מספר חדרים, פרטיות ומתקנים. כך מצמצמים אפשרויות בלי לפספס את מה שחשוב.", image: properties[0].image },
  { title: "חופשה בצפון: אזורים שכדאי להכיר", category: "יעדים", excerpt: "ההבדלים בין סובב כנרת, הגליל העליון והגליל המערבי, ולמי מתאים כל אזור.", image: properties[5].image },
  { title: "מקום אחד או מתחם עם כמה יחידות", category: "מדריך הזמנה", excerpt: "הבדלים חשובים למשפחה, לקבוצה ולזוגות שמחפשים פרטיות.", image: properties[1].image },
];
