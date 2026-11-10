"use client";
import { useNearbySort, NearbySortStatus } from "./use-nearby-sort";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { providerCategories, type ProviderCategoryId } from "../data/provider-categories";
import { localizedPath } from "../i18n/locale-routing";
import { providerCategorySearchHref, providerSearchHref } from "../lib/provider-search-state";
import { nearbyDefaultSort } from "../lib/nearby-page-content";
import { DiscoveryCard } from "./discovery-card";
import { ModernSelect } from "./modern-select";
import { ProgressiveResults } from "./progressive-results";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { SliderRailControls, scrollSliderRailToCard } from "./slider-rail-controls";
import { useDocumentSeed } from "./use-document-seed";
import { discoverySortLabel, discoverySortOptions, numericPriceLabel, orderDiscoveryResults, type DiscoverySortKey } from "../lib/discovery-result-sort";
import { providerGeographicServiceAreas, providerServesRegion } from "../lib/provider-service-areas";

const joinCopy: Record<SiteLanguage, { slot: string; title: string; description: string; action: string }> = {
  he: { slot: "מקום לספק הבא", title: "העסק שלכם יכול להיות כאן", description: "נותנים שירות לנופש או לאירועים? הציגו את העסק שלכם למי שמחפש ספק מתאים.", action: "פרטי הצטרפות כספק" },
  en: { slot: "A spot for the next provider", title: "Your business could be here", description: "Offer services for stays or events? Show your business to people looking for the right provider.", action: "Provider joining details" },
  ru: { slot: "Место для нового поставщика", title: "Здесь может быть ваш бизнес", description: "Предлагаете услуги для отдыха или мероприятий? Представьте свой бизнес тем, кто ищет подходящего поставщика.", action: "Условия для поставщиков" },
  fr: { slot: "Une place pour le prochain prestataire", title: "Votre activité pourrait être ici", description: "Vous proposez des services pour les séjours ou les événements ? Présentez votre activité aux personnes qui cherchent un prestataire adapté.", action: "Modalités pour les prestataires" },
};

const resultCountCopy: Record<SiteLanguage, { one: string; many: (count: number) => string }> = {
  he: { one: "ספק אחד", many: (count) => `${count} ספקים` },
  en: { one: "1 provider", many: (count) => `${count} providers` },
  ru: { one: "1 поставщик", many: (count) => `${count} поставщиков` },
  fr: { one: "1 prestataire", many: (count) => `${count} prestataires` },
};

function ProviderJoinCard() {
  const { language } = useSiteLanguage();
  const copy = joinCopy[language];
  return <article className="provider-join-card">
    <div className="provider-join-card__visual" aria-hidden="true"><span>+</span></div>
    <div className="provider-join-card__body">
      <span className="provider-join-card__eyebrow">{copy.slot}</span>
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      <Link href="/join/providers#provider-pricing">{copy.action}<span aria-hidden="true">←</span></Link>
    </div>
  </article>;
}

export function ProviderResults({ items, category = "all" }: { items: DiscoveryItem[]; category?: ProviderCategoryId }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const searchQuery = searchParams.toString();
  const categoryNavRef = useRef<HTMLElement>(null);
  const categoryRailId = useId();
  const { language, translate } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [region, setRegion] = useState(searchParams.get("region") || searchParams.get("location") || "כל הארץ");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();
  const [pendingCategory, setPendingCategory] = useState<ProviderCategoryId | null>(null);
  const [navigationDelayed, setNavigationDelayed] = useState(false);
  const nearby = useNearbySort();
  const sortModel = useMemo(() => ({ distance: nearby.distance, id: (item: DiscoveryItem) => item.id, name: (item: DiscoveryItem) => item.name, price: (item: DiscoveryItem) => numericPriceLabel(item.priceLabel), rating: (item: DiscoveryItem) => item.rating }), [nearby.origin]);
  const sortOptions = useMemo(() => discoverySortOptions(items, sortModel, language), [items, language, sortModel]);
  const requestedSort = nearby.defaultSort;
  const [sort, setSort] = useState<DiscoverySortKey>(sortOptions.some((option) => option.value === requestedSort) ? requestedSort as DiscoverySortKey : "recommended");
  const regions = useMemo(() => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => providerGeographicServiceAreas(item.serviceAreas?.length ? item.serviceAreas : [item.area])).filter((area) => area !== "כל הארץ" && area !== "בכל הארץ")))], [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("he");
    const matches = items.filter((item) => {
      const text = `${item.name} ${(item.searchTerms || []).join(" ")} ${item.area} ${item.description} ${item.features.join(" ")}`;
      const matchesQuery = !normalized || text.toLocaleLowerCase("he").includes(normalized);
      const matchesRegion = providerServesRegion(item.serviceAreas?.length ? item.serviceAreas : [item.area], region);
      return matchesQuery && matchesRegion;
    });
    return orderDiscoveryResults(matches, sort, `${documentSeed}:provider-search:${category}`, { ...sortModel, priority: item => (normalized && !item.name.toLocaleLowerCase("he").includes(normalized) ? 2 : 0) + (item.image ? 0 : 1) });
  }, [category, documentSeed, items, query, region, sort, sortModel]);

  function updateUrl(updates: Record<string, string>, replace = false) {
    const href = providerSearchHref(window.location.pathname, window.location.search, updates) + window.location.hash;
    // Preserve the framework's current navigation state. Text editing replaces
    // one search entry; discrete filter choices remain navigable with Back.
    window.history[replace ? "replaceState" : "pushState"](window.history.state, "", href);
  }

  function resetFilters() {
    setQuery("");
    setRegion("כל הארץ");
    setSort(nearbyDefaultSort(pathname, null) as DiscoverySortKey);
    updateUrl({ q: "", region: "", sort: "" });
  }

  useEffect(() => { setPendingCategory(null); setNavigationDelayed(false); setFiltersOpen(false); }, [category, pathname]);
  useEffect(() => {
    if (!pendingCategory) return;
    const timer = window.setTimeout(() => { setPendingCategory(null); setNavigationDelayed(true); }, 10_000);
    return () => window.clearTimeout(timer);
  }, [pendingCategory]);

  const labels = ({
    he: { filters: 'סינון', close: 'סגירת סינון', clear: 'ניקוי סינונים', loading: 'טוענים ספקים בתחום שנבחר', delayed: 'המעבר מתעכב. אפשר לבחור שוב את התחום.', empty: 'לא מצאנו התאמה לסינונים שבחרתם', hint: 'אפשר להסיר סינון או לבחור תחום אחר.' },
    en: { filters: 'Filters', close: 'Close filters', clear: 'Clear filters', loading: 'Loading the selected provider category', delayed: 'Navigation is taking longer. You can select the category again.', empty: 'No providers match these filters', hint: 'Remove a filter or choose another category.' },
    fr: { filters: 'Filtres', close: 'Fermer les filtres', clear: 'Effacer les filtres', loading: 'Chargement des prestataires sélectionnés', delayed: 'La navigation prend plus de temps. Vous pouvez sélectionner à nouveau la catégorie.', empty: 'Aucun prestataire ne correspond aux filtres', hint: 'Supprimez un filtre ou choisissez une autre catégorie.' },
    ru: { filters: 'Фильтры', close: 'Закрыть фильтры', clear: 'Сбросить фильтры', loading: 'Загружаем выбранную категорию', delayed: 'Переход занимает больше времени. Можно выбрать категорию ещё раз.', empty: 'Нет поставщиков по выбранным фильтрам', hint: 'Уберите фильтр или выберите другую категорию.' },
  } as const)[language];
  const activeFilterCount = Number(Boolean(query.trim())) + Number(region !== 'כל הארץ') + Number(sort !== nearbyDefaultSort(pathname, null));
  const categoryHref = (id: ProviderCategoryId) => localizedPath(providerCategorySearchHref(id, searchQuery, { query, region, sort }), language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      setQuery(params.get("q") || "");
      setRegion(params.get("region") || params.get("location") || "כל הארץ");
      const nextSort = params.get("sort") || nearby.defaultSort;
      setSort(sortOptions.some((option) => option.value === nextSort) ? nextSort as DiscoverySortKey : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nearby.defaultSort, searchQuery, sortOptions]);

  useEffect(() => {
    const rail = categoryNavRef.current;
    if (!rail) return;
    const selectedIndex = providerCategories.findIndex((entry) => entry.id === category);
    if (selectedIndex >= 0) scrollSliderRailToCard(rail, selectedIndex, ":scope > *");
  }, [category]);

  return <div className="provider-results" aria-busy={pendingCategory !== null}><NearbySortStatus state={nearby} regionalOnly />
    <div className="provider-results-toolbar">
      <p className="provider-results-count" aria-live="polite">{filtered.length === 1 ? resultCountCopy[language].one : resultCountCopy[language].many(filtered.length)}</p>
      <div className="provider-results-actions">
      <ModernSelect compact label={discoverySortLabel(language)} value={sort} onChange={(value) => { const next = sortOptions.some((option) => option.value === value) ? value as DiscoverySortKey : "recommended"; setSort(next); updateUrl({ sort: next === "recommended" && nearbyDefaultSort(pathname, null) === "recommended" ? "" : next }); }} options={sortOptions} />
      <button type="button" className="provider-filter-toggle" aria-label={filtersOpen ? labels.close : labels.filters} aria-expanded={filtersOpen} aria-controls={filterPanelId} onClick={() => setFiltersOpen(value => !value)}>{filtersOpen ? <span aria-hidden="true">×</span> : null}{labels.filters}{activeFilterCount ? <span>{activeFilterCount}</span> : null}</button>
      </div>
    </div>
    <div id={filterPanelId} className={`provider-toolbar${filtersOpen ? ' is-open' : ''}`}>
      <label className="provider-search"><span>{translate('חיפוש ספק')}</span><input value={query} onChange={(event) => { const value = event.target.value; setQuery(value); updateUrl({ q: value.trim() }, true); }} placeholder={translate('שם, שירות או תחום')} /></label>
      <ModernSelect retainSelectedOption label={translate('אזור שירות')} value={region} onChange={(value) => { setRegion(value); updateUrl({ region: value }); }} options={regions.map((option) => ({ value: option, label: translate(option) }))} />
      {activeFilterCount ? <button type="button" className="provider-reset" onClick={resetFilters}>{labels.clear}</button> : null}
    </div>
      <div className="provider-filter-options">
        <div className="provider-categories-shell">
          <nav id={categoryRailId} ref={categoryNavRef} className="provider-categories" aria-label="עמודי ספקים לפי תחום" data-horizontal-rail>
            {providerCategories.map((entry) => <Link key={entry.id} href={categoryHref(entry.id)} scroll={false} aria-current={category === entry.id ? "page" : undefined} aria-busy={pendingCategory === entry.id || undefined} onClick={(event) => { if (entry.id !== category && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { setNavigationDelayed(false); setPendingCategory(entry.id); } }}>{translate(entry.label)}{pendingCategory === entry.id ? <span className="provider-category-spinner" aria-hidden="true" /> : null}</Link>)}
          </nav>
          <SliderRailControls railId={categoryRailId} railRef={categoryNavRef} label="עמודי ספקים לפי תחום" className="provider-categories-controls" />
        </div>
      </div>
    {query || region !== 'כל הארץ' ? <div className="provider-active-filters" aria-label={labels.filters}>
      {query ? <button type="button" onClick={() => { setQuery(''); updateUrl({ q: '' }); }}>{query} ×</button> : null}
      {region !== 'כל הארץ' ? <button type="button" onClick={() => { setRegion('כל הארץ'); updateUrl({ region: '' }); }}>{region} ×</button> : null}
    </div> : null}
    {pendingCategory || navigationDelayed ? <p className="provider-navigation-status" role="status">{pendingCategory ? labels.loading : labels.delayed}</p> : null}
    {filtered.length ? <ProgressiveResults className="discovery-grid" kind="providers" featuredItem={<ProviderJoinCard />} resetKey={`${category}|${query}|${region}|${sort}`}>{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</ProgressiveResults> : <div className="provider-empty"><h3>{labels.empty}</h3><p>{labels.hint}</p>{activeFilterCount ? <button type="button" className="button primary" onClick={resetFilters}>{labels.clear}</button> : <Link href={categoryHref('all')}>{providerCategories[0].label}</Link>}</div>}
  </div>;
}
