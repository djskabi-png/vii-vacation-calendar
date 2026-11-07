import { nearbyRecommendations } from "../../lib/nearby-recommendations";
import type { EventPlace } from "../../data/site-data";
import { eventPlaceHref } from "../../data/site-data";
import { PlacePreviewCard } from "../../components/place-preview-card";
import { HomeMobileRail } from "../../components/home-mobile-rail";
import { SearchAfterResults } from "../../components/search-after-results";

export function EventRelatedSlot({ place, places }: { place: EventPlace; places: EventPlace[] }) {
  const related = nearbyRecommendations(places, place, { key: (entry) => entry.slug, exclude: place.slug, limit: 3 }).items;
  return <>
    <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים לאירוע</h2></div><HomeMobileRail shufflePlaces id="event-detail-nearby" label="מקומות נוספים לאירוע" className="event-more-grid">{related.map((item) => <PlacePreviewCard className="event-related-card" contact={{ placeId: item.slug, phone: item.contact?.phone, whatsapp: item.contact?.whatsapp, serviceName: item.type }} key={item.slug} name={item.name} image={item.image} images={item.images} href={eventPlaceHref(item)}><div><b>{item.name}</b><span>{item.location || item.area} · עד {item.guests} אורחים ביחידה הגדולה</span></div></PlacePreviewCard>)}</HomeMobileRail></div></section>
    <SearchAfterResults world="events" discoveryOnly location={place.location} inventory={[place, ...related].map(entry => ({ location: entry.location, area: entry.area, type: entry.type, eventTypes: entry.eventTypes }))} />
  </>;
}
