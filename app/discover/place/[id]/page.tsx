import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import DiscoveryPlacePage from "../client-page";
import { discoveryItems, hourlyPlacesFromCatalog, spaPlacesFromSites, type DiscoveryItem } from "../../../data/world-data";
import { StructuredData } from "../../../components/structured-data";
import { breadcrumbSchema, discoverySchema, faqSchema, worldBreadcrumb } from "../../../lib/seo";
import { ViewedItemBootstrap } from "../../../components/viewed-item-bootstrap";
import { getSpaDetails } from "../../../data/spa-details";
import { getProviderDetails } from "../../../data/provider-details";
import { getHourlyDetails } from "../../../data/hourly-details";
import { getActivityDetails } from "../../../data/activity-details";
import spaLegacyAliases from "../../../data/spaplus-legacy-aliases.json";
import { bundledPublicCatalogSummaries, publicCatalogSelectedSummaries } from "../../../lib/public-catalog-read.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { spaEditorialDescription, spaEditorialTitle } from "../../../data/spa-editorial";
import hourlyCatalog from "../../../data/sergey-hourly-catalog.json";
import { managedDiscoveryItems } from "../../../lib/managed-public-content";
import { serverLocalePath, serverPublicCopy } from "../../../i18n/server-public-copy";
import { hourlyBreadcrumbsForLocation } from "../../../data/world-search-landings";
import { spaBreadcrumbsForLocation } from "../../../data/spa-search-landings";
import { discoveryBreadcrumbsForLocation } from "../../../lib/place-breadcrumb-locations";

type Props = { params: Promise<{ id: string }> };

const resolveItem = cache(async (id: string) => {
  const spaAlias = (spaLegacyAliases as Record<string, string>)[id];
  if (spaAlias) redirect(await serverLocalePath(`/discover/place/${spaAlias}`));
  let items: DiscoveryItem[] = discoveryItems;
  let spaSite: SpaPlusSite | undefined;
  let hourlyPlace: (typeof hourlyCatalog.places)[number] | undefined;
  if (/^spa-\d+$/.test(id)) {
    const supplierId = Number(id.slice("spa-".length));
    const [acceptedSite, bundledSites] = await Promise.all([
      publicCatalogSelectedSummaries<SpaPlusSite>("spa", [supplierId]).then((sites) => sites[0]),
      bundledPublicCatalogSummaries<SpaPlusSite>("spa"),
    ]);
    const sites = acceptedSite
      ? [acceptedSite, ...bundledSites.filter((site) => site.id !== acceptedSite.id)]
      : bundledSites;
    items = spaPlacesFromSites(sites);
    spaSite = sites.find((site) => `spa-${site.id}` === id);
  } else if (/^hourly-\d+$/.test(id)) {
    const supplierId = Number(id.slice("hourly-".length));
    const [acceptedPlace, bundledPlaces] = await Promise.all([
      publicCatalogSelectedSummaries<(typeof hourlyCatalog.places)[number]>("rooms", [supplierId]).then((places) => places[0]),
      bundledPublicCatalogSummaries<(typeof hourlyCatalog.places)[number]>("rooms"),
    ]);
    const places = acceptedPlace
      ? [acceptedPlace, ...bundledPlaces.filter((place) => place.id !== acceptedPlace.id)]
      : bundledPlaces;
    items = hourlyPlacesFromCatalog(places);
    hourlyPlace = places.find((place) => place.id === id);
  } else {
    const [providers, attractions] = await Promise.all([
      managedDiscoveryItems(discoveryItems.filter((entry) => entry.world === "providers"), "providers"),
      managedDiscoveryItems(discoveryItems.filter((entry) => entry.world === "activities"), "attractions"),
    ]);
    const managed = new Map([...providers, ...attractions].map((entry) => [entry.id, entry]));
    items = discoveryItems.map((entry) => managed.get(entry.id) || entry);
  }
  const item = items.find((entry) => entry.id === id);
  if (!item) notFound();
  return { item: spaSite ? { ...item, description: spaSite.shortDescription || spaEditorialDescription(spaSite) } : item, items, spaSite, hourlyPlace };
});

function itemFaq(item: DiscoveryItem, spaSite?: SpaPlusSite, hourlyPlace?: (typeof hourlyCatalog.places)[number]) {
  if (item.world === "spa") return getSpaDetails(item.id, spaSite)?.faq || [];
  if (item.world === "providers") return getProviderDetails(item.id)?.faq || [];
  if (item.world === "hourly") return getHourlyDetails(item, hourlyPlace).faq;
  if (item.world === "activities") return getActivityDetails(item).faq;
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item, spaSite } = await resolveItem((await params).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  const { translate } = await serverPublicCopy();
  const title = translate(spaSite ? spaEditorialTitle(spaSite) : item.name);
  const description = translate(spaSite ? spaSite.shortDescription || spaEditorialDescription(spaSite) : item.description);
  const canonical = await serverLocalePath(`/discover/place/${item.id}`);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: item.image ? { type: "website", url: canonical, title, description, images: [{ url: item.image }] } : { type: "website", url: canonical, title, description },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const { item, items, spaSite, hourlyPlace } = await resolveItem((await params).id);
  const indexable = item.indexable === true || (item.indexable !== false && (item.world === "spa" || item.world === "hourly" || item.world === "activities"));
  const itemBreadcrumbs = item.world === "hourly"
    ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...hourlyBreadcrumbsForLocation(item.area, item.location), { name: item.name, path: `/discover/place/${item.id}` }]
    : item.world === "spa"
      ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...spaBreadcrumbsForLocation(item.area, item.location), { name: item.name, path: `/discover/place/${item.id}` }]
    : item.world === "activities"
      ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...discoveryBreadcrumbsForLocation("activities", item.area, item.location), { name: item.name, path: `/discover/place/${item.id}` }]
      : [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...discoveryBreadcrumbsForLocation("providers", undefined, item.location), { name: item.name, path: `/discover/place/${item.id}` }];
  return <>
    <ViewedItemBootstrap id={item.id} world={item.world} name={item.name} location={`${item.location}, ${item.area}`} image={item.image} href={`/discover/place/${item.id}`} meta={item.priceLabel || item.duration} />
    {indexable ? <StructuredData data={discoverySchema(item)} /> : null}
    {itemFaq(item, spaSite, hourlyPlace).length ? <StructuredData data={faqSchema(itemFaq(item, spaSite, hourlyPlace))} /> : null}
    <StructuredData data={breadcrumbSchema(itemBreadcrumbs)} />
    <DiscoveryPlacePage initialId={item.id} initialItem={item} relatedItems={items}
      initialSpaDetails={spaSite ? getSpaDetails(item.id, spaSite) : undefined}
      initialHourlyDetails={hourlyPlace ? getHourlyDetails(item, hourlyPlace) : undefined} />
  </>;
}
