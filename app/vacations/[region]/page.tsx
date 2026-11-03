import type { Metadata } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { VacationLandingRoute, vacationLandingMetadata } from "../../components/vacation-landing-route";
import { vacationRegionBySlug } from "../../data/vacation-landings.ts";
import { canonicalLegacyVacationSearchPath, semanticVacationFeaturesFromSearchParams, vacationSearchHasTransactionalState } from "../../lib/legacy-search-intent.ts";

type QueryValue = string | string[] | undefined;
type Props = { params: Promise<{ region: string }>; searchParams: Promise<Record<string, QueryValue>> };

function queryParams(values: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  });
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  return vacationLandingMetadata(region);
}

export default async function VacationRegionPage({ params, searchParams }: Props) {
  const { region } = await params;
  const [query, requestHeaders] = await Promise.all([searchParams, headers()]);
  const regionDefinition = vacationRegionBySlug(region);
  const filters = queryParams(query);
  const types = (filters.get("types") || filters.get("type") || "").split(",").map((value) => value.trim()).filter(Boolean);
  if ((requestHeaders.get("x-vii-locale") || "he") === "he" && regionDefinition && types.length <= 1 && !vacationSearchHasTransactionalState(filters)) {
    const approvedPath = canonicalLegacyVacationSearchPath({
      location: regionDefinition.label,
      type: types[0] || "",
      features: semanticVacationFeaturesFromSearchParams(filters),
    });
    if (approvedPath) permanentRedirect(approvedPath);
  }
  return <VacationLandingRoute regionSlug={region} />;
}

