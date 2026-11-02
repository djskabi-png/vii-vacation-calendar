import legacyTypes from "../data/legacy-vacation-accommodation-types.json" with { type: "json" };

type AccommodationTypeSource = {
  supplierId?: unknown;
  slug?: unknown;
  type?: unknown;
  types?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function supplierId(source: AccommodationTypeSource) {
  const direct = Number(source.supplierId);
  if (Number.isSafeInteger(direct) && direct > 0) return direct;
  const match = text(source.slug).match(/^vacation-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function vacationAccommodationTypes(source: AccommodationTypeSource, roomTypes: readonly unknown[] = []) {
  const id = supplierId(source);
  const legacyMemberships = id
    ? (legacyTypes.memberships as Record<string, string[]>)[String(id)] || []
    : [];
  return [...new Set([
    ...(Array.isArray(source.types) ? source.types.map(text) : []),
    ...roomTypes.map(text),
    ...legacyMemberships.map(text),
    text(source.type),
  ].filter(Boolean))];
}

export function withVacationAccommodationTypes<T extends AccommodationTypeSource>(source: T, roomTypes: readonly unknown[] = []): T & { types: string[] } {
  return { ...source, types: vacationAccommodationTypes(source, roomTypes) };
}
