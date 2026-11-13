import type { Property } from "./site-data";

// A deliberately tiny, build-owned catalog sample for discovery fallbacks.
// These are real published places, but they carry no dated availability or
// price claim. Keeping the sample detached from the full catalog prevents
// landing pages from loading the entire supplier payload just to avoid an
// empty rail while live availability refreshes.
export const homeFallbackProperties: Property[] = [
  {
    slug: "vacation-1", name: "אחוזת דוריאל", location: "יערה", area: "גליל מערבי", type: "מקום אירוח",
    guests: 5, image: "/api/vii/media/46686f6045c9036.jpeg", images: ["/api/vii/media/46686f6045c9036.jpeg", "/api/vii/media/48686f6045d0f4a.jpeg"],
    description: "", features: ["מיטה זוגית", "ג'קוזי זוגי מפנק", "מטבחון מאובזר"], audiences: [], badges: [], scenario: "multi", score: 9.9, reviews: 20,
    contact: { phone: "052-9097513", whatsapp: "050-9255550" },
  },
  {
    slug: "vacation-11", name: "הילת הנוף", location: "כלנית", area: "כנרת", type: "מקום אירוח",
    guests: 7, image: "/api/vii/media/87686399e3d2342.jpg", images: ["/api/vii/media/87686399e3d2342.jpg", "/api/vii/media/55686399e3cb360.jpg"],
    description: "", features: ["4 צימרים", "פינת ברביקיו", "בריכה מול הנוף"], audiences: [], badges: [], scenario: "multi", score: 9.9, reviews: 182,
    contact: { phone: "052-9097258", whatsapp: "054-9789850" },
  },
  {
    slug: "vacation-13", name: "וילה אל סלוודור", location: "פקיעין החדשה", area: "גליל מערבי", type: "מקום אירוח",
    guests: 40, image: "/api/vii/media/175f900fe45dc6f.jpeg", images: ["/api/vii/media/175f900fe45dc6f.jpeg", "/api/vii/media/835f900fe445074.jpeg"],
    description: "", features: ["10 חדרי שינה", "בריכת שחייה מחוממת", "ג'קוזי ספא"], audiences: [], badges: [], scenario: "single", score: 9.8, reviews: 45,
    contact: { phone: "055-4538025", whatsapp: "054-3275044" },
  },
  {
    slug: "vacation-15", name: "אחוזת השושנים בוטיק", location: "שומרה", area: "גליל מערבי", type: "מקום אירוח",
    guests: 17, image: "/api/vii/media/94683fd10328d9e.jpg", images: ["/api/vii/media/94683fd10328d9e.jpg", "/api/vii/media/88683fd103385a1.jpg"],
    description: "", features: ["5 חדרי שינה", "בריכה מחוממת ומקורה", "ג'קוזי ספא"], audiences: [], badges: [], scenario: "single", score: 10, reviews: 57,
    contact: { phone: "055-4538029", whatsapp: "050-3734051" },
  },
  {
    slug: "vacation-16", name: "אחוזת השף", location: "יערה", area: "גליל מערבי", type: "מקום אירוח",
    guests: 30, image: "/api/vii/media/596853c9a1213ac.jpg", images: ["/api/vii/media/596853c9a1213ac.jpg", "/api/vii/media/526853c9a0db080.jpg"],
    description: "", features: ["7 חדרי שינה", "בריכה מחוממת", "ג'קוזי ספא"], audiences: [], badges: [], scenario: "single", score: 9, reviews: 28,
    contact: { phone: "055-4538046", whatsapp: "052-6885994" },
  },
  {
    slug: "vacation-26", name: "אחוזת נירוונה בגליל", location: "חוסן", area: "גליל מערבי", type: "מקום אירוח",
    guests: 6, image: "/api/vii/media/90647f127011b14.jpeg", images: ["/api/vii/media/90647f127011b14.jpeg", "/api/vii/media/30647f127018493.jpeg"],
    description: "", features: ["7 סוויטות", "בריכה מחוממת ומקורה", "משחקי שולחן"], audiences: [], badges: [], scenario: "multi", score: 9.7, reviews: 44,
    contact: { phone: "052-9097202", whatsapp: "052-8260722" },
  },
];
