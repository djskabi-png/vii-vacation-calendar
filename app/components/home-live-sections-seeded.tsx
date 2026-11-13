import { HomeLiveSections } from "./home-showcase";
import { readHomeDealsSnapshot } from "../lib/home-deals-snapshot";
import { readHomeHolidaySnapshot } from "../lib/home-holiday-snapshot";
import { headers } from "next/headers";
import { homeFallbackProperties } from "../data/home-fallback-properties";

/** One read-only D1 attempt inside a streamed boundary. Native D1 reads are not
 * abortable: after the UI deadline a single outstanding read may finish, but
 * no supplier call or retry loop is started by this server component. */
export async function HomeLiveSectionsSeeded() {
  const requested = (await headers()).get("x-vii-locale") || "he";
  const locale = (["he", "en", "ru", "fr"].includes(requested) ? requested : "he") as "he" | "en" | "ru" | "fr";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // This boundary exists to make the availability rails appear immediately.
    // Loading the full vacation catalog here defeats that boundary, can exceed
    // the Worker memory budget, and hides quick-booking offers behind a page-
    // level skeleton. Keep a tiny build-owned set only for the truthful neutral
    // fallback while the verified D1 availability snapshot resolves.
    const fallbackProperties = homeFallbackProperties;
    const [initialData, initialHolidayData] = await Promise.race([
      Promise.all([
        readHomeDealsSnapshot({ guests: 2, locale }).catch(() => null),
        readHomeHolidaySnapshot({ guests: 2, locale }).catch(() => null),
      ]),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); }),
    ]) ?? [null, null];
    return <HomeLiveSections initialData={initialData} initialHolidayData={initialHolidayData} fallbackProperties={fallbackProperties} />;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
