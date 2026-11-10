import { providerCategoryHref, providerTopicCategories, providerMatchesCategory, type ProviderCategoryId } from '../data/provider-categories.ts';
import { providerGeographicServiceAreas } from './provider-service-areas.ts';
import type { DiscoveryItem } from '../data/world-data';

export type ProviderSearchState = { query: string; region: string; sort: string };

/** Keep the selected service, text and service area as one shareable search. */
export function providerSearchHref(path: string, currentSearch: string, updates: Record<string, string>) {
  const params = new URLSearchParams(currentSearch);
  for (const [key, value] of Object.entries(updates)) {
    if (value && !(key === 'region' && (value === 'all' || value === 'כל הארץ'))) params.set(key, value);
    else params.delete(key);
  }
  params.delete('page');
  if ('region' in updates) params.delete('location');
  return path + (params.size ? `?${params}` : '');
}

/** Breadcrumb geography describes verified service coverage, never office GPS. */
export function providerSearchBreadcrumbs(item: DiscoveryItem) {
  const category = providerTopicCategories.find(entry => providerMatchesCategory(item, entry));
  const path = providerCategoryHref(category || 'all');
  const area = providerGeographicServiceAreas(item.serviceAreas).find(value => value !== 'כל הארץ' && value !== 'בכל הארץ');
  return {
    category: category ? { name: category.label, path } : null,
    regions: area ? [{ name: `ספקים ב${area}`, path: providerSearchHref(path, '', { region: area }) }] : [],
  };
}

export function providerCategorySearchHref(category: ProviderCategoryId, currentSearch: string, state: ProviderSearchState) {
  return providerSearchHref(providerCategoryHref(category), currentSearch, {
    q: state.query.trim(), region: state.region, sort: state.sort === 'recommended' ? '' : state.sort,
  });
}
