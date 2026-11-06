/** Public entry routes and semantic headings shared by the private controller
 * and browser runner. These are discovery checks, not booking/map contracts. */
export const browserWorldPaths = Object.freeze({
  vacations: '/search', events: '/events/search', hourly: '/hourly', spa: '/spas',
  activities: '/attractions', providers: '/providers', trails: '/trails', global: '/',
});
export type PublicBrowserWorld = keyof typeof browserWorldPaths;
export const browserWorldSurfaceSelectors: Partial<Record<PublicBrowserWorld, string>> = Object.freeze({
  providers:'main.world-page--providers',activities:'main.attractions-page',trails:'main.trails-page',global:'main.home-page',
});
const headings: Partial<Record<PublicBrowserWorld, RegExp>> = {
  vacations: /נופש|צימרים|וילות/, events: /אירוע/, spa: /ספא/, hourly: /שעה|שעות/,
};
export function browserWorldHeadingMatches(world: PublicBrowserWorld, heading: string) {
  // These editable CMS headings are identified by their stable world surface,
  // not by forcing administrators to retain one particular marketing phrase.
  if (Object.hasOwn(browserWorldSurfaceSelectors,world)) return Boolean(heading.trim()) && !/^(?:העמוד לא נטען במלואו|העמוד שחיפשתם לא נמצא|התרחשה שגיאה)$/.test(heading.trim());
  return Object.hasOwn(headings, world) && Boolean(headings[world]?.test(heading));
}
