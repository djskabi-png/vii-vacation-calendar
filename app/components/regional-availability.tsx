"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { regionalAvailabilityRegion, type AvailabilityWorld } from "../lib/regional-availability";

const VacationDeals = dynamic(() => import("./home-live-deals").then(module => module.HomeLiveDeals));
const EventDeals = dynamic(() => import("./event-last-minute").then(module => module.EventLastMinute));
const SpaDeals = dynamic(() => import("./spa-package-deals").then(module => module.SpaPackageDeals));

export function RegionalAvailability({ world, region, guests, embedded = false }: { world: AvailabilityWorld; region?: string; guests?: number; embedded?: boolean }) {
  const params = useSearchParams();
  const scope = regionalAvailabilityRegion(world === "spa" ? params.get("location") ?? region : region);
  if (!scope) return null;
  const sectionId = `regional-${world}-${scope.key}`;
  return <div key={`${sectionId}-${guests || "default"}`} className={`regional-availability${embedded ? " regional-availability--embedded" : ""}`} data-region={scope.label} data-world={world}>
    {world === "vacation" ? <VacationDeals region={scope.label} guests={guests} />
      : world === "events" ? <EventDeals places={[]} region={scope.label} initialGuests={guests} sectionId={sectionId} />
      : <SpaDeals region={scope.label} sectionId={sectionId} />}
  </div>;
}
