import type { ExperienceContext } from '../../shared/experience-metrics.ts';

/** URLs are inspected locally. Only these coarse labels leave this function. */
export function experienceRouteContext(href: string): Pick<ExperienceContext, 'world' | 'routeKind' | 'locale'> | null {
  let url: URL;
  try { url = new URL(href, 'https://vii.spaplus.co'); } catch { return null; }
  const language = url.pathname.match(/^\/(he|en|fr|ru)(?=\/|$)/)?.[1];
  const locale = (language || 'he') as ExperienceContext['locale'];
  const path = url.pathname.replace(/^\/(he|en|fr|ru)(?=\/|$)/, '') || '/';
  if (/^\/(admin|account|favorites|booking|handoff|join|api)(\/|$)/.test(path)) return null;
  if (path === '/') return { world: 'global', routeKind: 'home', locale };
  if (path === '/business') {
    const world = url.searchParams.get('id')?.startsWith('vacation-') ? 'vacation' : url.searchParams.get('id')?.startsWith('event-') ? 'events' : null;
    return world ? { world, routeKind: 'place', locale } : null;
  }
  const discovered = path.match(/^\/discover\/place\/(spa|hourly)-/);
  if (discovered) return { world: discovered[1] === 'spa' ? 'spa' : 'hourly', routeKind: 'place', locale };
  const segment = path.split('/')[1];
  const worlds: Record<string, ExperienceContext['world']> = { events: 'events', corporate: 'events', spas: 'spa', hourly: 'hourly', activities: 'activities', attractions: 'activities', trails: 'trails', providers: 'providers', search: 'vacation', vacations: 'vacation', villas: 'vacation', zimmers: 'vacation', suites: 'vacation', 'luxury-suites': 'vacation', 'suite-complexes': 'vacation', 'vacation-apartments': 'vacation', 'hospitality-complexes': 'vacation', holidays: 'vacation' };
  if (worlds[segment]) return { world: worlds[segment], routeKind: path.includes('/place/') ? 'place' : path === `/${segment}` && segment !== 'search' ? 'world' : 'results', locale };
  if (['guides', 'questions', 'destinations'].includes(segment)) return { world: 'global', routeKind: 'editorial', locale };
  return null;
}
