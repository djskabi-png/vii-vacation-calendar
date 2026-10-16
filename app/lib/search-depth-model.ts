import { isWholeCountrySelection, matchesSearchLocation, searchLocationOptions, type SearchMode } from "../data/search-taxonomy";

export type SearchDepthInventoryPlace = {
  location: string;
  area: string;
  type?: string;
  eventTypes?: string[];
  serviceAreas?: string[];
  nature?: string[];
  difficulty?: string;
};

export type SearchDepthLocationLayers = {
  suitableRegions: string[];
  cities: string[];
  additionalRegions: string[];
  contextArea: string;
};

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value) && !/לא נמסר|לא צוין|עד לבית הלקוח|לפי מיקום|בתיאום/.test(value!)))];
}

function isPlaceLocation(value: string, inventory: SearchDepthInventoryPlace[]) {
  return inventory.some((item) => item.location === value);
}

export function buildSearchDepthLocationLayers(
  mode: SearchMode,
  location: string | undefined,
  inventory: SearchDepthInventoryPlace[],
): SearchDepthLocationLayers {
  const selected = location?.trim() || "";
  const wholeCountry = isWholeCountrySelection(selected);
  const exactPlaces = selected ? inventory.filter((item) => item.location === selected) : [];
  const exactAreas = unique(exactPlaces.map((item) => item.area));
  const contextArea = exactAreas[0] || selected;
  const contextInventory = wholeCountry
    ? inventory
    : exactAreas.length
      ? inventory.filter((item) => exactAreas.includes(item.area))
      : inventory.filter((item) => matchesSearchLocation(item, selected));

  const inventoryAreas = unique(inventory.map((item) => item.area));
  const contextAreas = unique(contextInventory.map((item) => item.area))
    .filter((item) => item !== selected);
  const knownOptions = searchLocationOptions(mode)
    .filter((item) => !isWholeCountrySelection(item) && item !== selected && !isPlaceLocation(item, inventory));
  const suitableRegions = wholeCountry
    ? unique([...inventoryAreas, ...knownOptions]).slice(0, 12)
    : unique([...contextAreas, ...knownOptions.filter((item) => contextInventory.some((place) => matchesSearchLocation(place, item)))]).slice(0, 10);
  const cities = unique(contextInventory.map((item) => item.location))
    .filter((item) => item !== selected)
    .slice(0, 16);
  const additionalRegions = unique([...inventoryAreas, ...knownOptions])
    .filter((item) => item !== selected && !suitableRegions.includes(item))
    .slice(0, 12);

  return { suitableRegions, cities, additionalRegions, contextArea };
}

export function isPlaceTypeSuggestion(params: Record<string, string | null>) {
  return Boolean(params.type || params.types);
}
