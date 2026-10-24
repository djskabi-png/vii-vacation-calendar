import type { SiteLanguage } from "../i18n/locale-provider";
import { discoverySeedCompare } from "./discovery-slider-order";

export type DiscoverySortKey = "recommended" | "popular" | "price-asc" | "price-desc" | "rating-desc" | "name";

type NumericValue<T> = (item: T) => number | undefined;

export type DiscoverySortModel<T> = {
  id: (item: T) => string | number;
  name: (item: T) => string;
  price?: NumericValue<T>;
  rating?: NumericValue<T>;
  popularity?: NumericValue<T>;
  priority?: NumericValue<T>;
};

const copy: Record<SiteLanguage, Record<DiscoverySortKey | "label", string>> = {
  he: { label: "מיון לפי", recommended: "מומלצים מתחלפים", popular: "פופולריים", "price-asc": "מחיר מהנמוך לגבוה", "price-desc": "מחיר מהגבוה לנמוך", "rating-desc": "הכי מדורגים", name: "שם א-ב" },
  en: { label: "Sort by", recommended: "Fresh recommendations", popular: "Most popular", "price-asc": "Price: low to high", "price-desc": "Price: high to low", "rating-desc": "Top rated", name: "Name A-Z" },
  ru: { label: "Сортировка", recommended: "Новые рекомендации", popular: "Популярные", "price-asc": "Цена: по возрастанию", "price-desc": "Цена: по убыванию", "rating-desc": "С лучшим рейтингом", name: "Название А-Я" },
  fr: { label: "Trier par", recommended: "Suggestions renouvelées", popular: "Les plus populaires", "price-asc": "Prix croissant", "price-desc": "Prix décroissant", "rating-desc": "Les mieux notés", name: "Nom A-Z" },
};

export function discoverySortLabel(language: SiteLanguage) {
  return copy[language].label;
}

export function discoverySortOptionLabel(value: DiscoverySortKey, language: SiteLanguage) {
  return copy[language][value];
}

export function discoverySortOptions<T>(items: readonly T[], model: DiscoverySortModel<T>, language: SiteLanguage) {
  const options: DiscoverySortKey[] = ["recommended"];
  if (model.popularity && items.some((item) => finite(model.popularity?.(item)))) options.push("popular");
  if (model.price && items.some((item) => finite(model.price?.(item)))) options.push("price-asc", "price-desc");
  if (model.rating && items.some((item) => finite(model.rating?.(item)))) options.push("rating-desc");
  options.push("name");
  return options.map((value) => ({ value, label: copy[language][value] }));
}

function finite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function compareKnownNumbers(first: number | undefined, second: number | undefined, direction: "asc" | "desc") {
  const firstKnown = finite(first);
  const secondKnown = finite(second);
  if (!firstKnown && !secondKnown) return 0;
  if (!firstKnown) return 1;
  if (!secondKnown) return -1;
  return direction === "asc" ? first - second : second - first;
}

export function orderDiscoveryResults<T>(items: readonly T[], sort: DiscoverySortKey, seed: string, model: DiscoverySortModel<T>): T[] {
  const stableFallback = (first: T, second: T) => discoverySeedCompare(model.id(first), model.id(second), seed);
  return [...items].sort((first, second) => {
    if (sort === "popular") return compareKnownNumbers(model.popularity?.(first), model.popularity?.(second), "desc")
      || compareKnownNumbers(model.rating?.(first), model.rating?.(second), "desc") || stableFallback(first, second);
    if (sort === "price-asc") return compareKnownNumbers(model.price?.(first), model.price?.(second), "asc") || stableFallback(first, second);
    if (sort === "price-desc") return compareKnownNumbers(model.price?.(first), model.price?.(second), "desc") || stableFallback(first, second);
    if (sort === "rating-desc") return compareKnownNumbers(model.rating?.(first), model.rating?.(second), "desc") || stableFallback(first, second);
    if (sort === "name") return model.name(first).localeCompare(model.name(second)) || stableFallback(first, second);
    return compareKnownNumbers(model.priority?.(first), model.priority?.(second), "asc") || stableFallback(first, second);
  });
}

export function numericPriceLabel(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : undefined;
}
