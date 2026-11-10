import { nearbyPageContent } from "./nearby-page-content.ts";
import type { HomeDiscoveryItem } from "./homepage-presentation";

export const popularSearchWorlds = [
  { id: "vacation", label: "נופש", href: "/search", attribute: "homePopularSearches" },
  { id: "spa", label: "ספא", href: "/spas", attribute: "homePopularSearchesSpa" },
  { id: "events", label: "אירועים", href: "/events/search", attribute: "homePopularSearchesEvents" },
  { id: "hourly", label: "לפי שעה", href: "/hourly", attribute: "homePopularSearchesHourly" },
  { id: "providers", label: "ספקים", href: "/providers", attribute: "homePopularSearchesProviders" },
  { id: "trails", label: "מסלולי טיול", href: "/trails", attribute: "homePopularSearchesTrails" },
  { id: "attractions", label: "אטרקציות", href: "/attractions", attribute: "homePopularSearchesAttractions" },
  { id: "corporate", label: "אירועי חברה", href: "/events/search?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94", attribute: "homePopularSearchesCorporate" },
] as const;
export type PopularSearchWorld = typeof popularSearchWorlds[number]["id"];
export function isPopularSearchWorld(value: unknown): value is PopularSearchWorld { return popularSearchWorlds.some(world => world.id === value); }
const images: Record<PopularSearchWorld, string[]> = {
 vacation:["/media/editorial/vacations-choose-region.webp","/media/editorial/vacations-family-planning.webp","/media/editorial/vacations-last-minute-without-compromise.webp","/media/editorial/one-villa-or-several-units.webp","/media/editorial/calm-family-vacation.webp","/media/editorial/couples-reset.webp","/media/editorial/eilat-slow-weekend.webp"],
 spa:["/media/editorial/spa-choose-treatment.webp","/media/editorial/spa-couple-experience.webp","/media/editorial/spa-day-plan.webp","/media/editorial/spa-day-with-vacation.webp","/media/editorial/couples-reset.webp","/media/editorial/calm-family-vacation.webp","/media/editorial/build-a-day-around-your-stay.webp","/media/editorial/choose-the-right-place.webp","/media/editorial/eilat-slow-weekend.webp"],
 events:["/media/editorial/events-build-brief.webp","/media/editorial/events-small-gathering.webp","/media/editorial/events-weather-plan.webp","/media/editorial/private-event-checklist.webp","/media/editorial/corporate-team-day.webp","/media/editorial/corporate-wellbeing-brief.webp"],
 hourly:["/media/editorial/hourly-between-trips.webp","/media/editorial/hourly-privacy.webp","/media/editorial/hourly-room-guide.webp","/media/editorial/hourly-stay-what-to-check.webp","/media/editorial/build-a-day-around-your-stay.webp","/media/editorial/couples-reset.webp"],
 providers:["/media/editorial/providers-compare-offers.webp","/media/editorial/providers-reliable-coordination.webp","/media/editorial/providers-service-at-home.webp","/media/editorial/corporate-team-day.webp","/media/editorial/corporate-wellbeing-brief.webp"],
 trails:["/media/editorial/trails-choose-level.webp","/media/editorial/trails-day-plan.webp","/media/editorial/trails-family-packing.webp"],
 attractions:["/media/editorial/attractions-family-day.webp","/media/editorial/attractions-two-hour-escape.webp","/media/editorial/attractions-water-safety.webp"],
 corporate:["/media/editorial/corporate-gift-choice.webp","/media/editorial/corporate-team-day.webp","/media/editorial/corporate-wellbeing-brief.webp","/media/editorial/events-build-brief.webp","/media/editorial/events-small-gathering.webp","/media/editorial/events-weather-plan.webp"],
};
const region = (base: string, slug: string) => `${base}/search/${slug}`;
const groups: Record<PopularSearchWorld, Array<[string,string]>> = {
 vacation:[["וילות נופש","/villas"],["צימרים","/zimmers"],["נופש בצפון","/vacations/north"],["נופש במרכז","/vacations/center"],["נופש בדרום","/vacations/south-negev"],["נופש ברגע האחרון","/last-minute"],["דירות נופש","/vacation-apartments"]],
 spa:[["ספא בבית מלון","/spas/hotel-spa"],["ספא עם לינה","/spas/spa-with-lodging"],["ספא עם חדר לכמה שעות","/spas/spa-hourly-room"],["ספא במרכז",region("/spas","center")],["ספא בדרום",region("/spas","south")],["ספא באזור ירושלים",region("/spas","jerusalem")],["ספא בצפון",region("/spas","north")],["ספא זוגי","/spas/couples-spa"],["ספא עם בריכה","/spas/spa-with-pool"]],
 events:[["לופטים","/events/search?type=%D7%9C%D7%95%D7%A4%D7%98%D7%99%D7%9D"],["וילות לאירועים","/events/search?type=%D7%95%D7%99%D7%9C%D7%95%D7%AA"],["אירועים במרכז",region("/events","center")],["אירועים בדרום",region("/events","south")],["אירועים בצפון",region("/events","north")],["אירועים ברגע האחרון","/events/last-minute"]],
 hourly:[["כניסה ללא מפגש","/hourly?features=independent"],["חדרים לפי שעה בדרום","/hourly?location=%D7%93%D7%A8%D7%95%D7%9D+%D7%95%D7%A0%D7%92%D7%91"],["חדרים לפי שעה במרכז",region("/hourly","center")],["חדרים לפי שעה בצפון",region("/hourly","north")],["עם ג׳קוזי","/hourly?features=jacuzzi"],["חדרים באזור ירושלים","/hourly/search/city-yrvshlym-vhry-yhvdh-1iecc"]],
 providers:[["שפים וקייטרינג","/providers/food"],["מוזיקה לאירוע","/providers/music"],["ספקים במרכז","/providers?region=%D7%9E%D7%A8%D7%9B%D7%96"],["ספקים בצפון","/providers?region=%D7%A6%D7%A4%D7%95%D7%9F"],["ספקים בדרום","/providers?region=%D7%93%D7%A8%D7%95%D7%9D+%D7%95%D7%A0%D7%92%D7%91"]],
 trails:[["מסלולים בצפון","/trails?area=%D7%A6%D7%A4%D7%95%D7%9F"],["מסלולים במרכז","/trails?area=%D7%9E%D7%A8%D7%9B%D7%96"],["מסלולים בדרום","/trails?area=%D7%93%D7%A8%D7%95%D7%9D+%D7%95%D7%A0%D7%92%D7%91"]],
 attractions:[["אטרקציות בצפון","/attractions?area=%D7%A6%D7%A4%D7%95%D7%9F"],["אטרקציות במרכז","/attractions?area=%D7%9E%D7%A8%D7%9B%D7%96+%D7%95%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91"],["אטרקציות בדרום","/attractions?area=%D7%93%D7%A8%D7%95%D7%9D+%D7%95%D7%A0%D7%92%D7%91"]],
 corporate:[["מקומות לאירוע עסקי","/events/search?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94"],["אירועי חברה במרכז","/events/search/center?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94"],["אירועי חברה בצפון","/events/search/north?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94"],["אירועי חברה בדרום","/events/search/south?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94"],["ספא לקבוצות","/spas/search/groups"],["שפים לאירוע חברה","/providers/food"]],
};
export function popularSearchesForWorld(world: PopularSearchWorld): HomeDiscoveryItem[] {
 const definition=popularSearchWorlds.find(entry=>entry.id===world)!;
 const nearbyUrl=new URL(definition.href,"https://vii.invalid");nearbyUrl.searchParams.set("sort","nearest");
 const rows: HomeDiscoveryItem[] = groups[world].map(([label,href],index)=>({id:`${world}-${index+1}`,label,note:"",href,image:images[world][index % images[world].length],imageAlt:`${definition.label}, תמונת אווירה`,visible:true}));
 return [{id:`${world}-nearby`,label:world in nearbyPageContent ? nearbyPageContent[world as keyof typeof nearbyPageContent].title : "מקומות לאירוע חברה קרובים אליי",note:"",href:world in nearbyPageContent ? nearbyPageContent[world as keyof typeof nearbyPageContent].path : `${nearbyUrl.pathname}${nearbyUrl.search}`,image:images[world][0],visible:true,action:"nearby"},...rows];
}
export const worldPopularSearchDefaults = popularSearchWorlds.flatMap(world=>popularSearchesForWorld(world.id).map(item=>({...item,world:world.id})));
