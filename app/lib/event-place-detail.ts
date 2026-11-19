import type { EventPlace, ListingFeatureGroup, StayOption } from "../data/site-data";
import type { SupplierPlaceDetail } from "../data/supplier-place-detail";

function nonEmptyGroups(groups: ListingFeatureGroup[] | undefined) {
  return (groups || []).filter((group) => group.title.trim() && group.items.length);
}

export function eventFeatureGroups(detail: SupplierPlaceDetail): ListingFeatureGroup[] {
  // Only shared supplier amenities belong to the venue. Room/space groups are
  // rendered inside their owning room and must never be promoted to the place.
  const source = nonEmptyGroups(detail.featureGroups);
  const merged = new Map<string, string[]>();
  for (const group of source) {
    const current = merged.get(group.title) || [];
    merged.set(group.title, [...new Set([...current, ...group.items])]);
  }
  return [...merged].map(([title, items]) => ({ title, items }));
}

export function eventRoomOptions(detail: SupplierPlaceDetail): StayOption[] {
  return detail.rooms.map((room) => ({
    ...(room.id ? { supplierRoomID: room.id } : {}),
    name: room.name,
    quantity: room.quantity,
    guests: room.guests,
    maxAdults: room.maxAdults,
    maxKids: room.maxKids,
    showKidsAndAdults: room.showKidsAndAdults,
    basisGuests: room.basisGuests,
    roomType: room.roomType,
    bedrooms: room.bedrooms,
    builtArea: room.builtArea,
    totalArea: room.totalArea,
    area: room.area,
    image: room.images?.[0] || "",
    images: room.images || [],
    features: room.features,
    featureGroups: room.featureGroups,
  }));
}

export function projectEventPlaceDetail(base: EventPlace, detail?: SupplierPlaceDetail): EventPlace {
  if (!detail) return base;
  const featureGroups = eventFeatureGroups(detail);
  const supplierFeatures = [...new Set([...(detail.features || []), ...featureGroups.flatMap((group) => group.items)])];
  const hasSupplierPropertyAmenities = featureGroups.length > 0 || supplierFeatures.length > 0;
  const roomOptions = eventRoomOptions(detail);
  return {
    ...base,
    name: detail.name || base.name,
    image: detail.images[0] || base.image,
    images: [...new Set([...(detail.images || []), ...(base.images || [])])],
    galleryGroups: detail.galleryGroups?.length ? detail.galleryGroups : base.galleryGroups,
    location: detail.location || base.location,
    area: detail.area || base.area,
    lat: detail.lat ?? base.lat,
    lng: detail.lng ?? base.lng,
    guests: detail.guests || base.guests,
    units: detail.units || base.units,
    contact: {
      ...base.contact,
      ...(detail.phone ? { phone: detail.phone } : {}),
      ...(detail.whatsapp ? { whatsapp: detail.whatsapp } : {}),
    },
    description: detail.summary || base.description,
    roomOptions: roomOptions.length ? roomOptions : base.roomOptions,
    featureGroups: hasSupplierPropertyAmenities ? featureGroups : base.featureGroups,
    features: hasSupplierPropertyAmenities ? supplierFeatures : base.features,
    highlights: detail.highlights?.length ? detail.highlights.map((label) => ({ label, icon: "default" as const })) : base.highlights,
  };
}
