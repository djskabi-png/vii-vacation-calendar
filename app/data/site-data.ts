export type Property = {
  slug: string;
  name: string;
  location: string;
  area: string;
  type: string;
  units?: number;
  guests: number;
  bedrooms: number;
  image: string;
  images: string[];
  score?: number;
  reviews?: number;
  price?: number;
  badges: string[];
  features: string[];
  scenario: "single" | "multi";
  liveUrl: string;
};

export const properties: Property[] = [
  {
    slug: "kesem-harimon",
    name: "קסם הרימון",
    location: "עזריקם",
    area: "מישור החוף והשפלה",
    type: "מתחם סוויטות",
    units: 4,
    guests: 14,
    bedrooms: 4,
    image: "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
    images: [
      "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
      "https://www.vii.co.il/gallery/3461b0895b7c07a.jpeg",
      "https://www.vii.co.il/gallery/426032b112228ee.jpeg",
      "https://www.vii.co.il/gallery/986032b1122a373.jpeg",
      "https://www.vii.co.il/gallery/261b0895b6faa4.jpeg",
    ],
    score: 9.8,
    reviews: 52,
    price: 800,
    badges: ["בחירה מבוקשת", "בריכה פרטית"],
    features: ["בריכה", "ג׳קוזי", "מטבח מאובזר", "מתאים למשפחות"],
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/villa_esem_harimon",
  },
  {
    slug: "aqua-resort",
    name: "אקווה ריזורט, וילת החוף",
    location: "אילת",
    area: "דרום",
    type: "וילה",
    guests: 12,
    bedrooms: 5,
    image: "https://www.vii.co.il/gallery/396a5627536911d.jpg",
    images: ["https://www.vii.co.il/gallery/396a5627536911d.jpg"],
    badges: ["קו ראשון לים", "מקום אירוח שלם"],
    features: ["בריכה", "נוף לים", "מטבח", "חניה"],
    scenario: "single",
    liveUrl: "https://www.vii.co.il/Aqua_Resort_-_Beachfront_Villa_Eilat",
  },
  {
    slug: "view-estate",
    name: "הילת הנוף",
    location: "כלנית",
    area: "סובב כנרת",
    type: "בקתות עץ",
    units: 4,
    guests: 16,
    bedrooms: 4,
    image: "https://www.vii.co.il/gallery/thumb/600/9686399e38f7b3.jpg",
    images: ["https://www.vii.co.il/gallery/thumb/600/9686399e38f7b3.jpg"],
    score: 10,
    reviews: 180,
    badges: ["דירוג אורחים גבוה"],
    features: ["בריכה", "נוף לכנרת", "מתאים למשפחות"],
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/",
  },
  {
    slug: "nesiya-boutique",
    name: "נסיה בוטיק",
    location: "נטועה",
    area: "גליל מערבי",
    type: "סוויטה",
    guests: 4,
    bedrooms: 1,
    image: "https://www.vii.co.il/gallery/thumb/600/126936d3700478d.JPG",
    images: ["https://www.vii.co.il/gallery/thumb/600/126936d3700478d.JPG"],
    badges: ["לזוגות"],
    features: ["בריכה", "ג׳קוזי", "פרטיות"],
    scenario: "single",
    liveUrl: "https://www.vii.co.il/",
  },
  {
    slug: "garden-suites",
    name: "סוויטות הגן הקסום גפן",
    location: "גפן",
    area: "מטה יהודה",
    type: "סוויטות",
    units: 3,
    guests: 10,
    bedrooms: 3,
    image: "https://www.vii.co.il/gallery/thumb/600/5960b4da6615590.jpeg",
    images: ["https://www.vii.co.il/gallery/thumb/600/5960b4da6615590.jpeg"],
    badges: ["מתאים למשפחות"],
    features: ["חצר", "בריכה", "מטבחון"],
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/HaGan_HaKasum_Gefen_Suites",
  },
  {
    slug: "anael-galilee",
    name: "אחוזת אנאאל בגליל",
    location: "גליל מערבי",
    area: "צפון",
    type: "סוויטות יוקרה",
    units: 4,
    guests: 16,
    bedrooms: 4,
    image: "https://www.vii.co.il/gallery/thumb/600/5962a5b1c42c285.jpeg",
    images: ["https://www.vii.co.il/gallery/thumb/600/5962a5b1c42c285.jpeg"],
    badges: ["מתחם פרטי"],
    features: ["בריכה", "מתחם חוץ", "מיזוג"],
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/Ahozat_Anael_Bgalil",
  },
];

export const destinations = [
  { name: "כנרת", subtitle: "מים, נוף וחופשה רגועה", image: properties[2].image },
  { name: "גליל מערבי", subtitle: "טבע ירוק ומקומות מיוחדים", image: properties[3].image },
  { name: "מרכז", subtitle: "חופשה קרובה בלי להתפשר", image: properties[0].image },
  { name: "אילת", subtitle: "שמש, ים ומקום משלכם", image: properties[1].image },
];

export const eventPlaces = [
  { name: "סטאר לופט", location: "נשר", image: "https://www.vii.co.il/gallery/thumb/600/5962a5b1c42c285.jpeg", type: "לופט לאירועים", guests: "לפי פרטי המקום", liveUrl: "https://www.vii.co.il/events/Star_Loft" },
  { name: "לופט 117", location: "תל אביב", image: "https://www.vii.co.il/gallery/thumb/600/3465c34aea44623.jpeg", type: "מתחם אירועים", guests: "לפי פרטי המקום", liveUrl: "https://www.vii.co.il/events/Villa_117" },
  { name: "לופט מועדון הפאזל", location: "ראשון לציון", image: "https://www.vii.co.il/gallery/thumb/600/4969134962140db.jpeg", type: "לופט", guests: "לפי פרטי המקום", liveUrl: "https://www.vii.co.il/events/Puzzle_Club_Loft" },
  { name: "פאפוס איוונטס", location: "רחובות", image: "https://www.vii.co.il/gallery/thumb/600/736811d99f268be.jpg", type: "מתחם אירועים", guests: "לפי פרטי המקום", liveUrl: "https://www.vii.co.il/events/Paphos_Events" },
  { name: "סיטי לופט ראשון לציון", location: "ראשון לציון", image: "https://www.vii.co.il/gallery/thumb/600/886a4a57f456c4d.jpg", type: "לופט לאירועים", guests: "לפי פרטי המקום", liveUrl: "https://www.vii.co.il/events/" },
];

export const guides = [
  { title: "איך לבחור מקום לחופשה שמתאים בדיוק להרכב", category: "תכנון חופשה", excerpt: "מיקום, מספר חדרים, פרטיות ומתקנים. כך מצמצמים אפשרויות בלי לפספס את מה שחשוב.", image: properties[0].image },
  { title: "חופשה בצפון: אזורים שכדאי להכיר", category: "יעדים", excerpt: "מה ההבדל בין סובב כנרת, גליל מערבי והעמקים, ולמי מתאים כל אזור.", image: properties[2].image },
  { title: "מקום אחד או מתחם עם כמה יחידות", category: "מדריך הזמנה", excerpt: "הבדלים חשובים למשפחה, לקבוצה ולזוגות שמחפשים פרטיות.", image: properties[1].image },
];
