type AmenityDefinition = {
  id: number;
  parentId: number;
  title: string;
  filterTitle: string;
  category: string;
};

export type SergeyAmenityIndex = {
  amenities: Map<number, AmenityDefinition>;
  roomTypes: Map<number, string>;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function id(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

export function buildSergeyAmenityIndex(value: unknown): SergeyAmenityIndex {
  const source = record(value);
  const categories = new Map<number, string>();
  for (const value of Array.isArray(source.amenity_categories) ? source.amenity_categories : []) {
    const category = record(value);
    const categoryId = id(category.categoryID);
    if (categoryId && text(category.categoryName)) categories.set(categoryId, text(category.categoryName));
  }
  const amenities = new Map<number, AmenityDefinition>();
  for (const value of Array.isArray(source.amenities) ? source.amenities : []) {
    const amenity = record(value);
    const amenityId = id(amenity.id);
    const title = text(amenity.title);
    if (!amenityId || !title) continue;
    amenities.set(amenityId, {
      id: amenityId,
      parentId: id(amenity.parentID),
      title,
      filterTitle: text(amenity.filterTitle),
      category: categories.get(id(amenity.categoryID)) || "מתקנים",
    });
  }
  const roomTypes = new Map<number, string>();
  for (const value of Array.isArray(source.roomTypes) ? source.roomTypes : []) {
    const roomType = record(value);
    const roomTypeId = id(roomType.id);
    if (roomTypeId && text(roomType.title)) roomTypes.set(roomTypeId, text(roomType.title));
  }
  return { amenities, roomTypes };
}

function normalizedAmenity(value: unknown, index: SergeyAmenityIndex) {
  const item = record(value);
  const amenityId = id(typeof value === "number" ? value : item.id);
  const definition = index.amenities.get(amenityId);
  return {
    id: amenityId,
    label: text(item.description) || definition?.title || "",
    category: definition?.category || "מתקנים",
    shown: item.shown !== false,
  };
}

export function sergeyAmenityLabels(values: unknown, index: SergeyAmenityIndex, includeHidden = false) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => normalizedAmenity(value, index))
    .filter((item) => item.label && (includeHidden || item.shown)).map((item) => item.label))];
}

export function sergeyAmenitySearchLabels(values: unknown, index: SergeyAmenityIndex) {
  if (!Array.isArray(values)) return [];
  const labels: string[] = [];
  for (const value of values) {
    const item = normalizedAmenity(value, index);
    if (item.label) labels.push(item.label);
    let current = index.amenities.get(item.id);
    const visited = new Set<number>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.title) labels.push(current.title);
      if (current.filterTitle) labels.push(current.filterTitle);
      current = current.parentId ? index.amenities.get(current.parentId) : undefined;
    }
  }
  return [...new Set(labels.filter(Boolean))];
}

export function sergeyAmenityGroups(values: unknown, index: SergeyAmenityIndex) {
  if (!Array.isArray(values)) return [];
  const groups = new Map<string, string[]>();
  for (const item of values.map((value) => normalizedAmenity(value, index))) {
    if (!item.label || !item.shown) continue;
    const current = groups.get(item.category) || [];
    if (!current.includes(item.label)) current.push(item.label);
    groups.set(item.category, current);
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

export function sergeyRoomType(value: unknown, index: SergeyAmenityIndex) {
  return index.roomTypes.get(id(value)) || "";
}
