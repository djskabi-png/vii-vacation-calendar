type AmenityDefinition = {
  id: number;
  parentId: number;
  title: string;
  filterTitle: string;
  category: string;
  categoryOrder: number;
  orderInCategory: number;
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

const canonicalAmenityLabels = new Map([
  ["בריכת שחיה מרעננת", "בריכת שחיה מחוממת"],
]);

export function canonicalSergeyAmenityLabel(value: unknown) {
  const label = text(value);
  return canonicalAmenityLabels.get(label) || label;
}

function id(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

export function buildSergeyAmenityIndex(value: unknown): SergeyAmenityIndex {
  const source = record(value);
  const categories = new Map<number, { title: string; order: number }>();
  for (const [index, value] of (Array.isArray(source.amenity_categories) ? source.amenity_categories : []).entries()) {
    const category = record(value);
    const categoryId = id(category.categoryID);
    if (categoryId && text(category.categoryName)) categories.set(categoryId, {
      title: text(category.categoryName),
      order: Number.isFinite(Number(category.order)) ? Number(category.order) : index,
    });
  }
  const amenities = new Map<number, AmenityDefinition>();
  for (const value of Array.isArray(source.amenities) ? source.amenities : []) {
    const amenity = record(value);
    const amenityId = id(amenity.id);
    const title = text(amenity.title);
    if (!amenityId || !title) continue;
    const category = categories.get(id(amenity.categoryID));
    amenities.set(amenityId, {
      id: amenityId,
      parentId: id(amenity.parentID),
      title,
      filterTitle: text(amenity.filterTitle),
      category: category?.title || "מתקנים",
      categoryOrder: category?.order ?? Number.MAX_SAFE_INTEGER,
      orderInCategory: Number.isFinite(Number(amenity.orderInCategory)) ? Number(amenity.orderInCategory) : Number.MAX_SAFE_INTEGER,
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

function normalizedAmenity(value: unknown, index: SergeyAmenityIndex, sourceOrder = 0) {
  const item = record(value);
  const amenityId = id(typeof value === "number" ? value : item.id);
  const definition = index.amenities.get(amenityId);
  return {
    id: amenityId,
    label: canonicalSergeyAmenityLabel(item.description) || canonicalSergeyAmenityLabel(definition?.title),
    category: definition?.category || "מתקנים",
    categoryOrder: definition?.categoryOrder ?? Number.MAX_SAFE_INTEGER,
    orderInCategory: definition?.orderInCategory ?? Number.MAX_SAFE_INTEGER,
    sourceOrder,
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
  const normalized = values.map((value, sourceOrder) => normalizedAmenity(value, index, sourceOrder))
    .sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderInCategory - b.orderInCategory || a.sourceOrder - b.sourceOrder);
  for (const item of normalized) {
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
