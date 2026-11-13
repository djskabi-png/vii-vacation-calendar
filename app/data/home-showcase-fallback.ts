import type { Property } from "./site-data";
import type { DiscoveryItem } from "./world-data";
import type { EventLastMinutePlace } from "../lib/event-last-minute-props";
import { homeFallbackProperties } from "./home-fallback-properties";

// The homepage must never deserialize the full supplier catalogs during a
// visitor request. These small, real catalog summaries keep the discovery
// sections useful immediately; the dedicated world pages remain the source
// for complete inventories and live availability.
export const homeShowcaseProperties: Pick<Property, "slug" | "name" | "location" | "area" | "image" | "videos">[] =
  homeFallbackProperties.map(({ slug, name, location, area, image, videos }) => ({ slug, name, location, area, image, videos }));

export const homeShowcaseEvents: Array<EventLastMinutePlace & { description: string }> = [
  { slug: "event-2", name: "סטאר לופט", location: "נשר", area: "חיפה וחוף הכרמל", type: "לופט", guests: 40, image: "/api/vii/media/5962a5b1c42c285.jpeg", images: ["/api/vii/media/5962a5b1c42c285.jpeg", "/api/vii/media/5162a5b1c43cb12.jpeg"], description: "לופט לאירועים פרטיים ומסיבות בנשר.", contact: { phone: "055-4538033", whatsapp: "052-7070691" } },
  { slug: "event-65", name: "אחוזת רפאלי", location: "פתחיה", area: "מישור החוף והשפלה", type: "מתחם אירועים", guests: 120, image: "/api/vii/media/9867714e2774f57.jpg", images: ["/api/vii/media/9867714e2774f57.jpg", "/api/vii/media/44677127ddf2c2e.jpeg"], description: "מתחם לאירועים פרטיים ומשפחתיים בפתחיה.", contact: { phone: "055-4317738", whatsapp: "050-9420374" } },
  { slug: "event-70", name: "סאנרייז על גג העולם", location: "כפר סבא", area: "שרון", type: "וילה לאירועים", guests: 50, image: "/api/vii/media/956736033706edb.JPG", images: ["/api/vii/media/956736033706edb.JPG", "/api/vii/media/136658345c61ace.jpeg"], description: "וילה ולופט לאירועים פרטיים בכפר סבא.", contact: { phone: "055-4538007", whatsapp: "053-6200767" } },
];

export const homeShowcaseHourly: DiscoveryItem[] = [
  { id: "hourly-194", world: "hourly", name: "הבקתות של סיוון", location: "שזור", area: "גליל עליון", description: "אירוח זוגי לפי שעה במתחם פרטי ודיסקרטי.", features: [], image: "/api/vii/media/415f83009b2ccf3.jpeg", images: ["/api/vii/media/415f83009b2ccf3.jpeg", "/api/vii/media/245f83009b1a01b.jpeg"], phone: "055-4549874", whatsapp: "052-3711253" },
  { id: "hourly-362", world: "hourly", name: "קדמת עדן", location: "שזור", area: "גליל עליון", description: "סוויטות זוגיות לפי שעה עם כניסה נפרדת ודיסקרטית.", features: [], image: "/api/vii/media/875f96a306047a3.jpeg", images: ["/api/vii/media/875f96a306047a3.jpeg", "/api/vii/media/595f96a305ca6c1.jpeg"], phone: "055-4549872", whatsapp: "050-7758175" },
  { id: "hourly-464", world: "hourly", name: "בית האצילים איוונטס", location: "נתניה", area: "שרון", description: "סוויטות זוגיות לפי שעה בנתניה.", features: [], image: "/api/vii/media/346ac617445e53b.jpg", images: ["/api/vii/media/346ac617445e53b.jpg", "/api/vii/media/536ac6174f88e3a.jpg"], phone: "055-4310573", whatsapp: "052-9371718" },
  { id: "hourly-475", world: "hourly", name: "טיטאניק ספא", location: "ראשון לציון", area: "מישור החוף והשפלה", description: "חדרים וסוויטות לאירוח זוגי לפי שעה.", features: [], image: "/api/vii/media/46673b29b3edff5.JPG", images: ["/api/vii/media/46673b29b3edff5.JPG", "/api/vii/media/40673b29b3d70df.JPG"], phone: "055-4549882" },
];

export const homeShowcaseProvider: DiscoveryItem = {
  id: "masu-home-wellness", world: "providers", name: "מאסו", location: "בכל הארץ", area: "עיסויים וטיפולי פנים עד הבית", description: "מטפלים מוסמכים שמגיעים לבית, למלון, לווילה, למשרד או לאירוע.", features: ["עיסוי עד הבית", "טיפולי פנים"], image: "/media/providers/masu/masu-home.jpg", images: ["/media/providers/masu/masu-home.jpg", "/media/providers/masu/masu-office.png"]
};

export const homeShowcaseAttraction: DiscoveryItem = {
  id: "eilat-sunset", world: "activities", name: "שקיעה לאורך מפרץ אילת", location: "אילת", area: "אילת והערבה", description: "הליכה רגועה לאורך הטיילת מול הים.", features: ["מסלול קל", "מתאים לזוגות"], image: "/media/activities/eilat-sunset.jpg"
};
