export type VerifiedSleepingRoom = {
  key: string;
  name: string;
  unitName?: string;
  details: string[];
  galleryImage?: string;
  bedroomCount: number;
  totalUnits?: number;
  availableUnits?: number;
};

type SleepingSourceRoom = {
  name: string;
  quantity: number;
  bedrooms: number;
  features?: string[];
  featureGroups?: Array<{ title: string; items: string[] }>;
  images?: string[];
  supplierRoomID?: number;
};

type SleepingGalleryGroup = { title: string; images: string[] };

function comparableSleepingTitle(value: string) {
  return value.trim().replace(/[?؟]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("he");
}

export function isVerifiedBedroomGroup(title: string) {
  const normalized = comparableSleepingTitle(title);
  return /^חדר שינה(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^bedroom(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^chambre(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^спальня(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized);
}

function isVerifiedSleepingFact(value: string) {
  return /מיטה|מיטות|מזרן|מזרנים|לול|עריסה|ספה\s+(?:נפתחת|לשינה)|\bbed(?:s|ding)?\b|mattress|crib|cot|sofa\s*bed|\blit(?:s)?\b|matelas|berceau|canapé[- ]lit|кровать|матрас|детская кроватка|диван[- ]кровать/i.test(value);
}

function bedroomCountLabel(count: number) {
  return count === 1 ? "חדר שינה אחד" : `${count} חדרי שינה`;
}

export function verifiedSleepingRoomsFromProperty({ rooms, galleryGroups = [], scenario, availableUnitCounts }: {
  rooms: SleepingSourceRoom[];
  galleryGroups?: SleepingGalleryGroup[];
  scenario: "single" | "multi";
  availableUnitCounts?: Record<number, number>;
}): VerifiedSleepingRoom[] {
  return (Array.isArray(rooms) ? rooms : []).flatMap((room, roomIndex) => {
    const totalUnits = Math.max(1, room.quantity || 1);
    const availableUnits = room.supplierRoomID === undefined || availableUnitCounts === undefined ? undefined
      : Math.min(totalUnits, Math.max(0, availableUnitCounts[room.supplierRoomID] || 0));
    const explicitGroups = (Array.isArray(room.featureGroups) ? room.featureGroups : []).flatMap((group, groupIndex) => {
      if (!group || typeof group.title !== "string" || !Array.isArray(group.items) || !isVerifiedBedroomGroup(group.title) || !group.items.length) return [];
      const galleryGroup = galleryGroups.find((gallery) => comparableSleepingTitle(gallery.title) === comparableSleepingTitle(group.title));
      return [{
        key: `${roomIndex}-${groupIndex}-${group.title}`,
        name: group.title,
        unitName: scenario === "multi" ? room.name : undefined,
        details: [...new Set(group.items)],
        galleryImage: galleryGroup?.images[0],
        bedroomCount: 1,
        totalUnits,
        availableUnits,
      }];
    });

    if (explicitGroups.length) return explicitGroups;

    const bedroomCount = Number.isFinite(room.bedrooms) ? Math.max(0, Math.floor(room.bedrooms)) : 0;
    if (!bedroomCount) return [];
    const sleepingFacts = [...new Set((room.features || []).filter(isVerifiedSleepingFact))];
    return [{
      key: `${roomIndex}-verified-bedroom-summary`,
      name: bedroomCountLabel(bedroomCount),
      unitName: scenario === "multi" ? room.name : undefined,
      details: sleepingFacts.length ? sleepingFacts : ["סוגי המיטות נמסרים באישור המקום"],
      galleryImage: room.images?.[0],
      bedroomCount,
      totalUnits,
      availableUnits,
    }];
  });
}
