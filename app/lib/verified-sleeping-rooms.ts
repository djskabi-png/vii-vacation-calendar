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
    || /^חדר\s+\d+(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^bedroom(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^chambre(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^спальня(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized);
}

function isNamedSleepingSpaceGroup(title: string) {
  const normalized = comparableSleepingTitle(title);
  return /^(?:סוויטה|סוויטת\s+הורים)(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized)
    || /^suite(?:\s+\d+)?(?:\s*[-–—:]\s*.+)?$/.test(normalized);
}

export function totalBedroomCountFromRooms(rooms: Array<{ bedrooms: number; quantity?: number }>) {
  return (Array.isArray(rooms) ? rooms : []).reduce((total, room) => {
    const bedrooms = Number.isFinite(room.bedrooms) ? Math.max(0, Math.floor(room.bedrooms)) : 0;
    const quantity = Number.isFinite(room.quantity) ? Math.max(1, Math.floor(room.quantity || 1)) : 1;
    return total + bedrooms * quantity;
  }, 0);
}

export function totalVerifiedBedroomCount(rooms: VerifiedSleepingRoom[]) {
  return (Array.isArray(rooms) ? rooms : []).reduce((total, room) => total + room.bedroomCount * Math.max(1, room.totalUnits || 1), 0);
}

function isVerifiedSleepingFact(value: string) {
  return /מיטה|מיטות|מזרן|מזרנים|לול|עריסה|ספה\s+(?:נפתחת|לשינה)|\bbed(?:s|ding)?\b|mattress|crib|cot|sofa\s*bed|\blit(?:s)?\b|matelas|berceau|canapé[- ]lit|кровать|матрас|детская кроватка|диван[- ]кровать/i.test(value);
}

export function verifiedBedroomGroupsFromRoom(room: Pick<SleepingSourceRoom, "bedrooms" | "featureGroups">) {
  const groups = (Array.isArray(room.featureGroups) ? room.featureGroups : [])
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => group && typeof group.title === "string" && Array.isArray(group.items) && group.items.length);
  const declaredBedrooms = Number.isFinite(room.bedrooms) ? Math.max(0, Math.floor(room.bedrooms)) : 0;
  const explicitIndexes = new Set(groups.filter(({ group }) => isVerifiedBedroomGroup(group.title)).map(({ index }) => index));
  const sleepingFactIndexes = groups
    .filter(({ group }) => declaredBedrooms > 0 && isNamedSleepingSpaceGroup(group.title) && group.items.some(isVerifiedSleepingFact))
    .map(({ index }) => index);
  const selectedIndexes = new Set(explicitIndexes);

  // Supplier room names are not always literally "חדר שינה". Suites and
  // similarly named sleeping spaces still belong in the bedroom list when
  // their contents contain verified bed facts. The declared bedroom count is
  // the authority that prevents auxiliary sleeping areas from inflating it.
  for (const index of sleepingFactIndexes) {
    if (declaredBedrooms && selectedIndexes.size >= declaredBedrooms) break;
    selectedIndexes.add(index);
  }

  const selected = groups.filter(({ index }) => selectedIndexes.has(index));
  return declaredBedrooms && selected.length > declaredBedrooms
    ? selected.slice(0, declaredBedrooms).map(({ group }) => group)
    : selected.map(({ group }) => group);
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
    const explicitGroups = verifiedBedroomGroupsFromRoom(room).flatMap((group, groupIndex) => {
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

    const groupedSleepingFacts = [...new Set((room.featureGroups || []).flatMap((group) => group.items || []).filter(isVerifiedSleepingFact))];
    const sleepingFacts = [...new Set((room.features || []).filter(isVerifiedSleepingFact))];
    const bedroomCount = Number.isFinite(room.bedrooms) ? Math.max(0, Math.floor(room.bedrooms)) : 0;
    // A supplier can confirm the sleeping arrangement without declaring a
    // bedroom count. Show those verified facts, but never invent a room.
    if (!bedroomCount && !groupedSleepingFacts.length) return [];
    // Do not manufacture a confirmation sentence when the supplier supplied
    // no room-level sleeping fact. The room can still be represented by its
    // verified bedroom count, while the absence of bed data remains explicit.
    const details = groupedSleepingFacts.length ? groupedSleepingFacts : sleepingFacts;
    return [{
      key: `${roomIndex}-verified-bedroom-summary`,
      name: bedroomCount ? bedroomCountLabel(bedroomCount) : "סידור השינה ביחידה",
      unitName: scenario === "multi" ? room.name : undefined,
      details,
      galleryImage: room.images?.[0],
      bedroomCount,
      totalUnits,
      availableUnits,
    }];
  });
}
