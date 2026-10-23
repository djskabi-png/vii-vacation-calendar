import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  AirVent,
  Archive,
  Baby,
  BadgeCheck,
  Bath,
  BedDouble,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Cigarette,
  CircleParking,
  Coffee,
  CookingPot,
  DoorOpen,
  Dumbbell,
  Eye,
  Flame,
  Gamepad2,
  Heart,
  KeyRound,
  LampDesk,
  LockKeyhole,
  Microwave,
  Music2,
  PawPrint,
  Refrigerator,
  ShieldCheck,
  ShowerHead,
  Snowflake,
  Sparkles,
  Thermometer,
  Trees,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  WashingMachine,
  Waves,
  Wifi,
  Wine,
  Zap,
} from "lucide-react";

export type FeatureIconKind =
  | "accessibility" | "air" | "bath" | "bed" | "business" | "coffee"
  | "cooking" | "door" | "events" | "fallback" | "family" | "fire"
  | "fitness" | "games" | "garden" | "heart" | "hotel" | "key"
  | "laundry" | "microwave" | "music" | "parking" | "pets" | "pool"
  | "refrigerator" | "security" | "shade" | "shower" | "smoking"
  | "snow" | "storage" | "temperature" | "television" | "utensils"
  | "view" | "volume" | "quiet" | "wifi" | "wine" | "power" | "desk";

const featureIcons: Record<FeatureIconKind, LucideIcon> = {
  accessibility: Accessibility,
  air: AirVent,
  bath: Bath,
  bed: BedDouble,
  business: BriefcaseBusiness,
  coffee: Coffee,
  cooking: CookingPot,
  door: DoorOpen,
  events: Sparkles,
  fallback: BadgeCheck,
  family: Users,
  fire: Flame,
  fitness: Dumbbell,
  games: Gamepad2,
  garden: Trees,
  heart: Heart,
  hotel: Building2,
  key: KeyRound,
  laundry: WashingMachine,
  microwave: Microwave,
  music: Music2,
  parking: CircleParking,
  pets: PawPrint,
  pool: Waves,
  refrigerator: Refrigerator,
  security: ShieldCheck,
  shade: Umbrella,
  shower: ShowerHead,
  smoking: Cigarette,
  snow: Snowflake,
  storage: Archive,
  temperature: Thermometer,
  television: Tv,
  utensils: Utensils,
  view: Eye,
  volume: Volume2,
  quiet: VolumeX,
  wifi: Wifi,
  wine: Wine,
  power: Zap,
  desk: LampDesk,
};

function normalizedFeatureLabel(label: string) {
  return label.normalize("NFKD").replace(/[\u0591-\u05c7]/g, "").replace(/[׳’`]/g, "'").trim().toLowerCase();
}

/**
 * Resolve supplier and CMS feature labels into stable visual concepts.
 * Specific phrases intentionally precede broad words. In particular, the
 * Hebrew word for sea is bounded so plural endings such as חדרים never match.
 */
export function featureIconKind(label: string): FeatureIconKind {
  const value = normalizedFeatureLabel(label);
  if (/נגיש|wheelchair|accessible|accessibility/.test(value)) return "accessibility";
  if (/ללא מפגש|כניסה עצמאית|כניסה דיסקרטית|מפתח|קוד כניסה|self.?check|private entry|key/.test(value)) return "key";
  if (/חדרי? שינה|מיטה|מיטות|מזרן|bed(room)?|sleep/.test(value)) return "bed";
  if (/אורחים|משפחה|משפחות|קבוצ|משתתפים|guests?|famil|group|people/.test(value)) return "family";
  if (/ארון|ארונות|שיד(?:ה|ות)|אחסון|storage|closet|wardrobe/.test(value)) return "storage";
  if (/בריכ|בריכת|שחייה|מים מחוממים|pool|swim/.test(value)) return "pool";
  if (/ג'קוזי|סאונה|ספא|חמאם|עיסוי|טיפול|אמבט|jacuzzi|hot tub|sauna|spa|massage|treatment/.test(value)) return "bath";
  if (/מקלחת|חדר רחצה|שירותים|מגבות|חלוק|shower|bathroom|toilet|towel|robe/.test(value)) return "shower";
  if (/מטבח|מטבחון|כיריים|תנור|סירים|kitchen|stove|oven|cookware/.test(value)) return "cooking";
  if (/מקרר|מקפיא|fridge|refrigerator|freezer/.test(value)) return "refrigerator";
  if (/מיקרוגל|microwave/.test(value)) return "microwave";
  if (/קפה|קומקום|מכונת אספרסו|coffee|espresso|kettle/.test(value)) return "coffee";
  if (/כלי אוכל|סכו"ם|סכום|ארוח|מסעד|קייטרינג|breakfast|meal|restaurant|catering|utensil/.test(value)) return "utensils";
  if (/יין|אלכוהול|בר |מיני בר|wine|alcohol|minibar/.test(value)) return "wine";
  if (/wifi|wi-fi|אינטרנט|רשת אלחוטית/.test(value)) return "wifi";
  if (/טלוויז|מסך|lcd|smart tv|cinema|projector|מקרן/.test(value)) return "television";
  if (/מזגן|מיזוג|אוורור|air.?condition|ventilat/.test(value)) return "air";
  if (/חימום|מחוממ|קירור|טמפרטור|heating|heated|temperature/.test(value)) return "temperature";
  if (/כביסה|מכונת כביסה|מייבש|laundry|washer|dryer/.test(value)) return "laundry";
  if (/חניה|רכב|מוסך|parking|garage|car/.test(value)) return "parking";
  if (/עמדת טעינה|טעינה חשמלית|שקע|חשמל|ev charg|power outlet/.test(value)) return "power";
  if (/מעלית|קומה|בניין|מלון|elevator|lift|floor|hotel/.test(value)) return "hotel";
  if (/חצר|גינה|מדשא|מרפסת|דק|טבע|יער|garden|yard|lawn|balcony|terrace|nature|forest/.test(value)) return "garden";
  if (/נוף|תצפית|חוף|אוקיינוס|(?:^|[\s,./-])ים(?:$|[\s,./-])|view|sea|beach|ocean/.test(value)) return "view";
  if (/שמשי|שיזוף|מיטת שיזוף|פרגולה|צל|sunbed|sun lounger|pergola|shade/.test(value)) return "shade";
  if (/מנגל|גריל|bbq|barbecue|fire pit|מדורה/.test(value)) return "fire";
  if (/ללא הגבלת רעש|בלי הגבלת רעש|no noise limit/.test(value)) return "volume";
  if (/שקט|בידוד רעש|ללא רעש|quiet|soundproof/.test(value)) return "quiet";
  if (/מוזיקה|הגברה|רמקול|קריוקי|dj|music|sound system|speaker|karaoke/.test(value)) return "music";
  if (/משחק|סנוקר|ביליארד|פינג פונג|פלייסטיישן|game|snooker|billiard|ping pong|playstation/.test(value)) return "games";
  if (/חדר כושר|אימון|fitness|gym|workout/.test(value)) return "fitness";
  if (/תינוק|ילד|לול|כיסא אוכל|baby|child|crib|cot|high chair/.test(value)) return "family";
  if (/חיות מחמד|כלבים|pets?|dog friendly/.test(value)) return "pets";
  if (/עישון|smoking|smoker/.test(value)) return "smoking";
  if (/כספת|ממ"ד|ממד|אבטחה|מצלמות|שומר|safe|security|shelter|camera/.test(value)) return "security";
  if (/שולחן עבודה|עמדת עבודה|desk|workspace/.test(value)) return "desk";
  if (/עסק|כנס|ישיבה|משרד|business|conference|meeting|office/.test(value)) return "business";
  if (/זוג|רומנט|couple|romantic/.test(value)) return "heart";
  if (/אירוע|מסיבה|חתונה|יום הולדת|event|party|wedding|birthday/.test(value)) return "events";
  if (/סוויט|יחידת|חדר|וילה|לופט|suite|unit|room|villa|loft/.test(value)) return "door";
  if (/פרטיות|דיסקרטי|נעילה|privacy|private|lock/.test(value)) return "security";
  return "fallback";
}

export function FeatureIcon({ label, className = "feature-icon" }: { label: string; className?: string }) {
  const kind = featureIconKind(label);
  const Icon = featureIcons[kind];
  return <span className={`${className} ${className}--${kind}`} data-feature-icon={kind} aria-hidden="true"><Icon strokeWidth={1.9} /></span>;
}
