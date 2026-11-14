import { HomeQuickSearches } from "./home-discovery-sections";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { readHomepagePresentation } from "../lib/homepage-presentation";
import { runtimeDatabase } from "../lib/runtime-database";
import type { PopularSearchWorld } from "../lib/world-popular-search-defaults";

/**
 * Renders the saved discovery state in the first server response.
 *
 * Managed world pages must not paint defaults and then replace them after
 * hydration. If the authoritative store cannot be read, omitting the optional
 * rail is safer than briefly publishing content the editor removed.
 */
export async function ManagedHomeQuickSearches({ world = "vacation" }: { world?: PopularSearchWorld }) {
  const { language } = await serverPublicCopy();
  const database = await runtimeDatabase().catch(() => undefined);
  if (!database) return null;
  const presentation = await readHomepagePresentation(database, language, world).catch(() => null);
  if (!presentation) return null;
  return <HomeQuickSearches world={world} initialPresentation={presentation} />;
}
