export type Listing = {
  slug: string;
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
  audiences: string[];
  badges: string[];
  lat: number;
  lng: number;
  scenario: "single" | "multi";
  liveUrl: string;
  score?: number;
  reviews?: number;
  price?: number;
  roomOptions?: StayOption[];
  contact?: ListingContact;
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
};

export type Property = Listing;

const commonVacationFaq = [
  { question: "איך בודקים זמינות?", answer: "בוחרים תאריכים והרכב אורחים. בשלב החיבור למערכת הניהול תוצג זמינות חיה לכל מקום ולכל יחידה." },
  { question: "האם המיקום במפה מדויק?", answer: "המפה מבוססת על נקודת המיקום שמופיעה בעמוד המקור של המקום באתר הקיים." },
  { question: "איפה רואים מחיר סופי?", answer: "המחיר הסופי תלוי בתאריכים, בהרכב וביחידות שנבחרו. הוא יוצג לאחר חיבור מנוע ההזמנות הקיים." },
];

export const propertyFaq = commonVacationFaq;

export const properties: Property[] = [
  {
    slug: "aqua-resort",
    name: "אקווה ריזורט, וילת החוף",
    location: "אילת",
    area: "אילת והערבה",
    type: "וילה",
    guests: 14,
    bedrooms: 5,
    image: "https://www.vii.co.il/gallery/396a5627536911d.jpg",
    images: ["https://www.vii.co.il/gallery/396a5627536911d.jpg", "https://www.vii.co.il/gallery/56a56275356f2a.jpg", "https://www.vii.co.il/gallery/256a5627535fb08.jpg", "https://www.vii.co.il/gallery/546a56275fdc17d.jpg", "https://www.vii.co.il/gallery/696a56275fe3d8e.jpg"],
    description: "וילה יוקרתית באילת עם חמישה חדרי שינה, בריכת חוף פרטית ונוף לים סוף ולהרי אדום. המקום מתאים לעד 14 אורחים.",
    features: ["בריכת חוף פרטית", "נוף לים", "מטבח מאובזר", "חניה", "מיזוג אוויר"],
    audiences: ["משפחות", "קבוצות", "זוגות"],
    badges: ["קרוב לים", "מקום אירוח שלם"],
    lat: 29.545042,
    lng: 34.9440222,
    scenario: "single",
    liveUrl: "https://www.vii.co.il/Aqua_Resort_-_Beachfront_Villa_Eilat",
    contact: { phone: "055-4500077", whatsapp: "054-4285059" },
    roomOptions: [
      {
        name: "אקווה ריזורט, וילת החוף",
        quantity: 1,
        guests: 14,
        bedrooms: 5,
        image: "https://www.vii.co.il/gallery/thumb/600/256a5627535fb08.jpg",
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
    image: "https://www.vii.co.il/gallery/661b0895b65730.jpeg",
    images: ["https://www.vii.co.il/gallery/661b0895b65730.jpeg", "https://www.vii.co.il/gallery/3461b0895b7c07a.jpeg", "https://www.vii.co.il/gallery/426032b112228ee.jpeg", "https://www.vii.co.il/gallery/986032b1122a373.jpeg", "https://www.vii.co.il/gallery/261b0895b6faa4.jpeg"],
    description: "מתחם נופש במושב עזריקם עם ארבע סוויטות, בריכת שחייה, ג'קוזי ספא ומשחקי שולחן. מתאים לעד 14 אורחים.",
    features: ["בריכת שחייה", "ג'קוזי ספא", "משחקי שולחן", "מטבח מאובזר", "מתחם חוץ"],
    audiences: ["משפחות", "קבוצות", "זוגות"],
    badges: ["ארבע סוויטות", "מתאים לקבוצות"],
    lat: 31.7492396,
    lng: 34.7048635,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/villa_esem_harimon",
    contact: { phone: "055-4538035", whatsapp: "058-4205153" },
    roomOptions: [
      { name: "יחידת סטודיו שני", quantity: 1, guests: 4, bedrooms: 1, area: 40, image: "https://www.vii.co.il/gallery/thumb/600/336032b1123593a.jpeg", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "מרפסת", "מיזוג אוויר"] },
      { name: "יחידת סטודיו העמק", quantity: 1, guests: 2, bedrooms: 1, area: 20, image: "https://www.vii.co.il/gallery/thumb/600/156032b112398d1.jpeg", features: ["מיטה זוגית", "מטבחון מאובזר", "מרפסת", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטה משפחתית וואנדרפול", quantity: 1, guests: 5, bedrooms: 1, area: 65, image: "https://www.vii.co.il/gallery/thumb/600/66032b11240b59.jpeg", features: ["ג'קוזי זוגי", "מטבחון מאובזר", "סלון", "מרפסת", "יציאה לחצר"] },
      { name: "יחידת עכו", quantity: 1, guests: 3, bedrooms: 1, area: 20, image: "https://www.vii.co.il/gallery/thumb/600/166226082f4a216.jpeg", features: ["מיטה זוגית", "מטבחון", "פינת אוכל", "מיזוג אוויר", "חדר רחצה פרטי"] },
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
    image: "https://www.vii.co.il/gallery/66645b97583777e.JPG",
    images: ["https://www.vii.co.il/gallery/66645b97583777e.JPG", "https://www.vii.co.il/gallery/33645b97583ec31.JPG", "https://www.vii.co.il/gallery/76645b975854915.JPG", "https://www.vii.co.il/gallery/55645b97587c9ee.JPG", "https://www.vii.co.il/gallery/28645b97586ee7c.JPG"],
    description: "שלוש סוויטות יוקרתיות בכלנית עם בריכת שחייה, ג'קוזי זוגי בכל סוויטה, משחקי שולחן ואבזור מלא. המתחם מתאים לעד 12 אורחים.",
    features: ["בריכת שחייה", "ג'קוזי בכל סוויטה", "משחקי שולחן", "מטבחון", "נוף"],
    audiences: ["משפחות", "זוגות", "קבוצות קטנות"],
    badges: ["ליד הכנרת", "שלוש סוויטות"],
    lat: 32.875043,
    lng: 35.4536474,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/Ahuzat_Or",
    contact: { phone: "052-9170990", whatsapp: "050-7780463" },
    roomOptions: [
      { name: "סוויטות 1+2", quantity: 2, guests: 3, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/75645b976e1e630.JPG", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "מרפסת", "חדר רחצה פרטי"] },
      { name: "סוויטה משפחתית", quantity: 1, guests: 6, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/42645b976e06d9c.JPG", features: ["מיטה זוגית", "ג'קוזי זוגי", "מטבחון מאובזר", "פינת אוכל", "חדר רחצה פרטי"] },
    ],
  },
  {
    slug: "ar-suites",
    name: "א.ר סוויטות",
    location: "אילת",
    area: "אילת והערבה",
    type: "דירת נופש",
    units: 1,
    guests: 7,
    bedrooms: 2,
    image: "https://www.vii.co.il/gallery/3064eae26ccc6a4.jpeg",
    images: ["https://www.vii.co.il/gallery/3064eae26ccc6a4.jpeg", "https://www.vii.co.il/gallery/266433eebd992db.jpeg", "https://www.vii.co.il/gallery/776433eebd7e5cd.jpeg", "https://www.vii.co.il/gallery/456433eebd66e9c.jpeg", "https://www.vii.co.il/gallery/236433eebd84060.jpeg"],
    description: "דירת נופש מעוצבת ומאובזרת באילת עם שני חדרי שינה, סלון, מטבח וחצר עם בריכת שחייה מחוממת. מתאימה לעד שבעה אורחים.",
    features: ["בריכה מחוממת", "מטבח מאובזר", "חצר פרטית", "סלון", "מיזוג אוויר"],
    audiences: ["משפחות", "זוגות"],
    badges: ["דירה שלמה", "בריכה מחוממת"],
    lat: 29.5526362,
    lng: 34.9480892,
    scenario: "single",
    liveUrl: "https://www.vii.co.il/A.R_Suite",
    roomOptions: [
      { name: "א.ר סוויטות", quantity: 1, guests: 7, bedrooms: 2, image: "https://www.vii.co.il/gallery/thumb/600/46433eebd8ccbd.jpeg", features: ["בריכה מחוממת", "מטבח מאובזר", "סלון משותף", "חצר", "חניה פרטית"] },
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
    image: "https://www.vii.co.il/gallery/79636b81692b92d.jpeg",
    images: ["https://www.vii.co.il/gallery/79636b81692b92d.jpeg", "https://www.vii.co.il/gallery/70636b8168df1e8.jpeg", "https://www.vii.co.il/gallery/10636b816925f37.jpeg", "https://www.vii.co.il/gallery/31636b81690d669.jpeg", "https://www.vii.co.il/gallery/80636b81692ea6a.jpeg"],
    description: "מתחם אירוח בגלגל המשלב שש סוויטות, מרחבי חוץ ואפשרות לנופש או לאירוע. המתחם כולל שמונה חדרי שינה ומתאים לעד 26 אורחים.",
    features: ["בריכת שחייה", "גינה פרטית", "מדשאות", "פינת ישיבה", "מטבחון מאובזר"],
    audiences: ["משפחות", "קבוצות", "אירועים קטנים"],
    badges: ["שש סוויטות", "מתאים לקבוצות"],
    lat: 32.9086754,
    lng: 35.8009862,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/Sol-_Events_And_Parties",
    contact: { phone: "055-4538181", whatsapp: "052-4477779" },
    roomOptions: [
      { name: "סוויטה 1", quantity: 1, guests: 8, bedrooms: 2, image: "https://www.vii.co.il/gallery/thumb/600/7636b81690993d.jpeg", features: ["בריכת שחייה", "גינה פרטית", "מטבחון מאובזר", "פינת ישיבה", "מיזוג אוויר"] },
      { name: "סוויטה 2", quantity: 1, guests: 6, bedrooms: 2, image: "https://www.vii.co.il/gallery/thumb/600/19636b8169059aa.jpeg", features: ["ג'קוזי", "מרפסת", "מטבחון מאובזר", "מסכי טלוויזיה", "מיזוג אוויר"] },
      { name: "סוויטה 3", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/94636b816901794.jpeg", features: ["ג'קוזי", "גינה פרטית", "מטבחון מאובזר", "ספה נפתחת", "חדר רחצה"] },
      { name: "סוויטה 4", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/94636b8169219da.jpeg", features: ["ג'קוזי זוגי", "בר חיצוני", "מטבחון מאובזר", "ספה נפתחת", "חדר רחצה פרטי"] },
      { name: "חדר שינה", quantity: 2, guests: 2, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/51636b816915a5b.jpeg", features: ["מיטה זוגית", "מטבחון מאובזר", "מסך טלוויזיה", "מיזוג אוויר", "שידות אחסון"] },
    ],
  },
  {
    slug: "infinity-suites",
    name: "סוויטות אינסוף",
    location: "אביבים",
    area: "גליל עליון",
    type: "סוויטות",
    units: 2,
    guests: 10,
    bedrooms: 2,
    image: "https://www.vii.co.il/gallery/35669383e49bb54.jpg",
    images: ["https://www.vii.co.il/gallery/35669383e49bb54.jpg", "https://www.vii.co.il/gallery/805f956e96d2409.jpeg", "https://www.vii.co.il/gallery/515f956e96c7931.jpeg", "https://www.vii.co.il/gallery/35f956e9704db9.jpeg", "https://www.vii.co.il/gallery/155f956e969e143.jpeg"],
    description: "שתי סוויטות באביבים עם ג'קוזי ספא מחומם ומקורה, בריכה, מטבחונים, פינות ישיבה וקמין עצים. המתחם מתאים לעד עשרה אורחים.",
    features: ["בריכה", "ג'קוזי ספא", "קמין עצים", "מטבחון", "פינת מנגל"],
    audiences: ["זוגות", "משפחות"],
    badges: ["שתי סוויטות", "גליל עליון"],
    lat: 33.089381,
    lng: 35.470338,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/suitot_einsof",
    roomOptions: [
      { name: "סוויטה 1", quantity: 1, guests: 6, bedrooms: 2, image: "https://www.vii.co.il/gallery/thumb/600/735f956ea9e52bc.jpeg", features: ["ג'קוזי זוגי", "ג'קוזי ספא", "מטבחון", "סלון", "חדר רחצה פרטי"] },
      { name: "סוויטה 2", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/685f956ebc1efd3.jpeg", features: ["בריכה מחוממת", "ג'קוזי ספא", "מטבחון מאובזר", "סלון", "חדר רחצה פרטי"] },
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
    image: "https://www.vii.co.il/gallery/686a68539e3779f.JPG",
    images: ["https://www.vii.co.il/gallery/686a68539e3779f.JPG", "https://www.vii.co.il/gallery/336a68539e8567d.JPG", "https://www.vii.co.il/gallery/166a68539ec945b.JPG", "https://www.vii.co.il/gallery/126a6853b67ad7d.JPG", "https://www.vii.co.il/gallery/146a6853b5eaae1.JPG"],
    description: "מתחם פרטי במושב גפן עם ארבע סוויטות מאובזרות, בריכה מחוממת ומקורה, מטבח מרכזי ומשחקי שולחן. מתאים לעד 20 אורחים.",
    features: ["בריכה מחוממת ומקורה", "מטבח מרכזי", "משחקי שולחן", "מתחם פרטי", "חצר"],
    audiences: ["משפחות", "קבוצות"],
    badges: ["ארבע סוויטות", "בריכה מקורה"],
    lat: 31.7447,
    lng: 34.8796582,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/HaGan_HaKasum_Gefen_Suites",
    contact: { phone: "055-4500620", whatsapp: "050-8534766" },
    roomOptions: [
      { name: "סוויטות הגן הקסום גפן", quantity: 4, guests: 5, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/956a68539e055b5.JPG", features: ["בריכה מחוממת ומגודרת", "מטבח מאובזר", "מיזוג אוויר", "חדר אוכל", "חדר רחצה"] },
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
    image: "https://www.vii.co.il/gallery/846a58794eb3e39.jpeg",
    images: ["https://www.vii.co.il/gallery/846a58794eb3e39.jpeg", "https://www.vii.co.il/gallery/296a58793ad297b.jpeg", "https://www.vii.co.il/gallery/386a58794eb7bc2.jpeg", "https://www.vii.co.il/gallery/406a58794ecc098.jpeg", "https://www.vii.co.il/gallery/236a58794ea79bb.jpeg"],
    description: "שש סוויטות בוטיק בגליל העליון עם ג'קוזי פרטי, בריכה מגודרת, ספא, סאונה ומשחקים לכל המשפחה. המתחם מתאים לעד 23 אורחים.",
    features: ["בריכה מגודרת", "ג'קוזי פרטי", "ספא", "סאונה", "משחקים למשפחה"],
    audiences: ["משפחות", "זוגות", "קבוצות"],
    badges: ["שש סוויטות", "מתחם ספא"],
    lat: 33.0131356,
    lng: 35.4428227,
    scenario: "multi",
    liveUrl: "https://www.vii.co.il/Ahozat_Anael_Bgalil",
    contact: { phone: "055-4500075", whatsapp: "050-4240966" },
    roomOptions: [
      { name: "סוויטת מירון", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/906a587a6b4f48b.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטת גאיה", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/666a587a0ba70f5.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת אליה", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/826a58793ac3ee4.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת נועה", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/216a5879219a2cb.jpeg", features: ["מיטה זוגית", "ג'קוזי גדול", "מטבחון מאובזר", "מסך טלוויזיה", "חדר רחצה פרטי"] },
      { name: "סוויטת יובל", quantity: 1, guests: 4, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/536a58793a9a9c8.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
      { name: "סוויטת חרמון", quantity: 1, guests: 3, bedrooms: 1, image: "https://www.vii.co.il/gallery/thumb/600/406a58794ecc098.jpeg", features: ["מיטה זוגית", "ג'קוזי ספא", "מטבחון מאובזר", "פינת ישיבה", "חדר רחצה פרטי"] },
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
    image: "https://www.vii.co.il/gallery/746a4e0f1534c1f.jpeg",
    images: ["https://www.vii.co.il/gallery/746a4e0f1534c1f.jpeg", "https://www.vii.co.il/gallery/776a4e0f15551ad.jpeg", "https://www.vii.co.il/gallery/426a4e0f151d86d.jpeg", "https://www.vii.co.il/gallery/176a4e0f15977e9.jpeg", "https://www.vii.co.il/gallery/766a4e0f14a38b2.jpeg"],
    description: "וילה באילת עם תשעה חדרי שינה, בריכת שחייה, נוף, סלון גדול ומטבח מאובזר. מתאימה לעד 30 אורחים.",
    features: ["בריכת שחייה", "נוף", "מטבח מאובזר", "סלון גדול", "מתאים לציבור הדתי"],
    audiences: ["משפחות", "קבוצות", "זוגות", "ציבור דתי"],
    badges: ["תשעה חדרים", "עד 30 אורחים"],
    lat: 29.539488,
    lng: 34.933483,
    scenario: "single",
    liveUrl: "https://www.vii.co.il/Parfumes_Villa",
    contact: { phone: "055-4538221", whatsapp: "054-4233163" },
    roomOptions: [
      { name: "וילת הבשמים", quantity: 1, guests: 30, bedrooms: 9, image: "https://www.vii.co.il/gallery/thumb/600/776a4e0f15551ad.jpeg", features: ["בריכת שחייה", "מטבח מאובזר", "שני סלונים", "חניה פרטית", "תשעה חדרי שינה"] },
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
    image: "https://www.vii.co.il/gallery/94683fd10328d9e.jpg",
    images: ["https://www.vii.co.il/gallery/94683fd10328d9e.jpg", "https://www.vii.co.il/gallery/88683fd103385a1.jpg", "https://www.vii.co.il/gallery/62683fd10323f35.jpg", "https://www.vii.co.il/gallery/29683fd129b34b5.jpg", "https://www.vii.co.il/gallery/56683fd187d1302.jpg"],
    description: "וילת בוטיק בשומרה עם חמישה חדרי שינה, בריכה מחוממת ומקורה, ג'קוזי ספא, מטבח מאובזר ונוף גלילי. מתאימה לעד 17 אורחים.",
    features: ["בריכה מחוממת ומקורה", "ג'קוזי ספא", "מטבח מאובזר", "נוף גלילי", "משחקי שולחן"],
    audiences: ["משפחות", "זוגות", "קבוצות", "ציבור דתי"],
    badges: ["וילת בוטיק", "בריכה מקורה"],
    lat: 33.087485,
    lng: 35.288424,
    scenario: "single",
    liveUrl: "https://www.vii.co.il/ahuzat_hashoshanim",
    contact: { phone: "055-4538029", whatsapp: "050-3734051" },
    roomOptions: [
      { name: "אחוזת השושנים בוטיק", quantity: 1, guests: 17, bedrooms: 5, area: 200, image: "https://www.vii.co.il/gallery/thumb/600/3683fd1032e080.jpg", features: ["בריכה מחוממת ומקורה", "ג'קוזי ספא", "מטבח מאובזר", "סלון משותף", "חמישה חדרי שינה"] },
    ],
  },
];

export type EventPlace = Listing & { eventTypes: string[] };

export const eventPlaces: EventPlace[] = [
  {
    slug: "party-time", name: "לופט פארטי טיים", location: "מצליח", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 40,
    image: "https://www.vii.co.il/gallery/66696f9756b5e92.png",
    images: ["https://www.vii.co.il/gallery/66696f9756b5e92.png", "https://www.vii.co.il/gallery/446825b49ebdc31.jpg", "https://www.vii.co.il/gallery/466825b49ea9554.jpg", "https://www.vii.co.il/gallery/616825b49ec92db.jpg", "https://www.vii.co.il/gallery/7860c72868e1d47.jpeg"],
    description: "לופט למסיבות במושב מצליח עם בריכה, פינות ישיבה, ערסלים, מקרן, מערכת הגברה ותאורה וג'קוזי.",
    features: ["בריכה", "ג'קוזי", "מערכת הגברה", "תאורה", "מקרן"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["עד 40 אורחים"], lat: 31.906364, lng: 34.871278, scenario: "single", liveUrl: "https://www.vii.co.il/events/party_time",
  },
  {
    slug: "black-loft", name: "בלאק לופט", location: "נשר", area: "חיפה וחוף הכרמל", type: "לופט", units: 1, guests: 80,
    image: "https://www.vii.co.il/gallery/196a6071f6c6fb5.jpg",
    images: ["https://www.vii.co.il/gallery/196a6071f6c6fb5.jpg", "https://www.vii.co.il/gallery/746a6071f6ee76e.jpg", "https://www.vii.co.il/gallery/946a6071f6cb170.jpg", "https://www.vii.co.il/gallery/766a6071f709f64.jpg", "https://www.vii.co.il/gallery/296a6071f704b9d.jpg"],
    description: "מתחם אירועים אורבני בנשר בשטח של כ־180 מ״ר, עם סנוקר, קריוקי, אפשרות לברביקיו וללא הגבלת רעש.",
    features: ["קריוקי", "סנוקר", "ברביקיו", "ללא הגבלת רעש", "חלל ממוזג"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["ללא הגבלת רעש", "עד 80 אורחים"], lat: 32.7729976, lng: 35.0464748, scenario: "single", liveUrl: "https://www.vii.co.il/events/Black_Loft",
    contact: { phone: "055-4538062" },
  },
  {
    slug: "sani-loft", name: "סאני לופט", location: "פתח תקווה", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 1, guests: 300,
    image: "https://www.vii.co.il/gallery/9567ac62d7d9ce8.JPG",
    images: ["https://www.vii.co.il/gallery/9567ac62d7d9ce8.JPG", "https://www.vii.co.il/gallery/24691997fc4e823.jpeg", "https://www.vii.co.il/gallery/6167ac62e735773.JPG", "https://www.vii.co.il/gallery/79691997fc44484.jpeg", "https://www.vii.co.il/gallery/69691997fc51900.jpeg"],
    description: "מתחם אירועים בפתח תקווה לעד 300 אורחים עם חללים גמישים, בר מעוצב ומערכות סאונד ותאורה.",
    features: ["בר מעוצב", "מערכת סאונד", "תאורה", "חללים גמישים", "רחבת אירוח"], audiences: ["אירועים עסקיים", "אירועים משפחתיים", "מסיבות"], eventTypes: ["אירוע עסקי", "אירוע משפחתי", "מסיבה"], badges: ["עד 300 אורחים"], lat: 32.1074967, lng: 34.8938899, scenario: "single", liveUrl: "https://www.vii.co.il/events/sani_loft",
    contact: { phone: "055-4311082" },
  },
  {
    slug: "360-events", name: "360 איוונטס", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "לופט ומתחם אירועים", units: 2, guests: 200,
    image: "https://www.vii.co.il/gallery/21650be045b2902.jpeg",
    images: ["https://www.vii.co.il/gallery/21650be045b2902.jpeg", "https://www.vii.co.il/gallery/5650be0455ccef.jpeg", "https://www.vii.co.il/gallery/18650be04572298.jpeg", "https://www.vii.co.il/gallery/97650be0456a70e.jpeg", "https://www.vii.co.il/gallery/45650be0454c05c.jpeg"],
    description: "שני מתחמי אירועים בראשון לציון, לופט מעוצב ואולם מאובזר, עם בריכה ומשחקי שולחן.",
    features: ["בריכה", "משחקי שולחן", "אולם מאובזר", "לופט", "מערכת הגברה"], audiences: ["אירועים פרטיים", "אירועים משפחתיים", "מסיבות"], eventTypes: ["אירוע פרטי", "אירוע משפחתי", "מסיבה"], badges: ["שני מתחמים", "עד 200 אורחים"], lat: 31.9949496, lng: 34.7670958, scenario: "multi", liveUrl: "https://www.vii.co.il/events/360_Events",
    contact: { phone: "055-4317903" },
  },
  {
    slug: "loft-117", name: "לופט 117", location: "תל אביב", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 25, bedrooms: 2,
    image: "https://www.vii.co.il/gallery/3465c34aea44623.jpeg",
    images: ["https://www.vii.co.il/gallery/3465c34aea44623.jpeg", "https://www.vii.co.il/gallery/6265c34aea3dbca.jpeg", "https://www.vii.co.il/gallery/2863da30589103b.jpeg", "https://www.vii.co.il/gallery/2763da30588d207.jpeg", "https://www.vii.co.il/gallery/665c34aea6791b.jpeg"],
    description: "מתחם אירועים בתל אביב המתפרס על שלוש קומות, עם בריכה, ג'קוזי, סנוקר ומערכות הגברה, ללא הגבלת רעש.",
    features: ["בריכה", "ג'קוזי", "סנוקר", "מערכת הגברה", "ללא הגבלת רעש"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["שלוש קומות", "ללא הגבלת רעש"], lat: 32.0526142, lng: 34.770393, scenario: "single", liveUrl: "https://www.vii.co.il/events/Villa_117",
    contact: { phone: "055-4538052" },
  },
  {
    slug: "fiesta", name: "פיאסטה", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 1, guests: 150,
    image: "https://www.vii.co.il/gallery/8667a9f6b88f322.jpeg",
    images: ["https://www.vii.co.il/gallery/8667a9f6b88f322.jpeg", "https://www.vii.co.il/gallery/8567a9f6b860688.jpeg", "https://www.vii.co.il/gallery/7667a9f6b868f76.jpeg", "https://www.vii.co.il/gallery/5067a9f6b85bcae.jpeg", "https://www.vii.co.il/gallery/4667a9f6b86df0b.jpeg"],
    description: "מתחם לאירועים ומסיבות בראשון לציון עם גג מעוצב, תאורה צבעונית, מערכת הגברה ומקרן.",
    features: ["גג מעוצב", "תאורה", "מערכת הגברה", "מקרן", "רחבת אירוח"], audiences: ["מסיבות", "אירועים פרטיים", "אירועים משפחתיים"], eventTypes: ["מסיבה", "אירוע פרטי", "אירוע משפחתי"], badges: ["עד 150 אורחים"], lat: 31.9899591, lng: 34.7696283, scenario: "single", liveUrl: "https://www.vii.co.il/events/FIESTA_-_Event_and_Party_Venue",
    contact: { phone: "055-4311895" },
  },
  {
    slug: "details-events", name: "דיטלס איוונטס", location: "אשקלון", area: "מישור החוף הדרומי", type: "לופט", units: 1, guests: 100,
    image: "https://www.vii.co.il/gallery/2769cbb1392a225.jpg",
    images: ["https://www.vii.co.il/gallery/2769cbb1392a225.jpg", "https://www.vii.co.il/gallery/3569cbb1393e401.jpg", "https://www.vii.co.il/gallery/3569cbb139451cb.jpg", "https://www.vii.co.il/gallery/6269cbb1394be81.jpg", "https://www.vii.co.il/gallery/9969cbb13952381.jpg"],
    description: "לופט באשקלון עם מתחם בריכה, אולם פנימי, מערכות שמע ושולחן סנוקר.",
    features: ["בריכה", "אולם פנימי", "מערכת שמע", "סנוקר", "פינת מנגל"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["עד 100 אורחים"], lat: 31.6677184, lng: 34.6058536, scenario: "single", liveUrl: "https://www.vii.co.il/events/Details_Events",
    contact: { phone: "055-4538170" },
  },
  {
    slug: "star-loft", name: "סטאר לופט", location: "נשר", area: "חיפה וחוף הכרמל", type: "לופט", units: 1, guests: 40,
    image: "https://www.vii.co.il/gallery/5962a5b1c42c285.jpeg",
    images: ["https://www.vii.co.il/gallery/5962a5b1c42c285.jpeg", "https://www.vii.co.il/gallery/5162a5b1c43cb12.jpeg", "https://www.vii.co.il/gallery/062a5b1c438706.jpeg", "https://www.vii.co.il/gallery/9862a5b1c432aaf.jpeg", "https://www.vii.co.il/gallery/4162a5b1c440ec3.jpeg"],
    description: "מתחם אירועי בוטיק בנשר בעיצוב אורבני, עם מערכות טכנולוגיות ואווירה אינטימית.",
    features: ["עיצוב אורבני", "מערכת הגברה", "תאורה", "חלל ממוזג", "אזור ישיבה"], audiences: ["מסיבות", "אירועים פרטיים", "ימי הולדת"], eventTypes: ["מסיבה", "אירוע פרטי", "יום הולדת"], badges: ["בוטיק", "עד 40 אורחים"], lat: 32.7748383, lng: 35.0417679, scenario: "single", liveUrl: "https://www.vii.co.il/events/Star_Loft",
    contact: { phone: "055-4538033" },
  },
  {
    slug: "puzzle-club", name: "לופט מועדון הפאזל", location: "ראשון לציון", area: "מישור החוף והשפלה", type: "לופט", units: 1, guests: 100,
    image: "https://www.vii.co.il/gallery/1693031bab4525.jpeg",
    images: ["https://www.vii.co.il/gallery/1693031bab4525.jpeg", "https://www.vii.co.il/gallery/61693031bb22b92.jpeg", "https://www.vii.co.il/gallery/25693031ba340af.jpeg", "https://www.vii.co.il/gallery/72693031bb950fb.jpeg", "https://www.vii.co.il/gallery/2362a0809cab687.jpeg"],
    description: "לופט בראשון לציון לאירועים של עד 100 אורחים, עם קריוקי, תאורה, הגברה ומשחקי שולחן, ללא הגבלת רעש.",
    features: ["קריוקי", "תאורה", "מערכת הגברה", "משחקי שולחן", "ללא הגבלת רעש"], audiences: ["מסיבות", "ימי הולדת", "אירועים פרטיים"], eventTypes: ["מסיבה", "יום הולדת", "אירוע פרטי"], badges: ["ללא הגבלת רעש", "עד 100 אורחים"], lat: 32.0507881, lng: 34.7698469, scenario: "single", liveUrl: "https://www.vii.co.il/events/Puzzle_Club_Loft",
    contact: { phone: "055-4538006" },
  },
  {
    slug: "paphos-events", name: "פאפוס איוונטס", location: "רחובות", area: "מישור החוף והשפלה", type: "מתחם אירועים", units: 2, guests: 160,
    image: "https://www.vii.co.il/gallery/7366a2314f6443a.jpeg",
    images: ["https://www.vii.co.il/gallery/7366a2314f6443a.jpeg", "https://www.vii.co.il/gallery/5566a7397ab89f5.jpg", "https://www.vii.co.il/gallery/736811d99f268be.jpg", "https://www.vii.co.il/gallery/9166a2314f3ea49.jpeg", "https://www.vii.co.il/gallery/736811d99fd026b.jpg"],
    description: "שני מתחמי אירועים ברחובות עם חבילות אירוח מגוונות ואפשרות לאוכל, אלכוהול ובידור, ללא הגבלת רעש.",
    features: ["שני מתחמים", "ללא הגבלת רעש", "חבילות אירוח", "מערכת הגברה", "רחבת אירוח"], audiences: ["מסיבות", "אירועים פרטיים", "אירועים עסקיים"], eventTypes: ["מסיבה", "אירוע פרטי", "אירוע עסקי"], badges: ["שני מתחמים", "עד 160 אורחים"], lat: 31.8900148, lng: 34.780923, scenario: "multi", liveUrl: "https://www.vii.co.il/events/Paphos_Events",
    contact: { phone: "055-4538198" },
  },
];

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
