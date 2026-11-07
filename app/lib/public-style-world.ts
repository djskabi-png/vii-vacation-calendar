export function publicStyleWorld(pathname: string): 'all' | 'vacations' | 'events' | 'hourly' | 'spa' {
  const path = pathname.replace(/^\/(?:en|ru|fr)(?=\/|$)/, '') || '/';
  if (/^\/(?:search\/)?events(?:\/|$)/.test(path)) return 'events';
  if (/^\/(?:search\/)?spas(?:\/|$)/.test(path)) return 'spa';
  if (/^\/(?:search\/)?hourly(?:\/|$)/.test(path)) return 'hourly';
  if (/^\/(?:search|vacations|villas|zimmers|suites|luxury-suites|suite-complexes|vacation-apartments|hospitality-complexes|last-minute|weekend|holidays)(?:\/|$)/.test(path)) return 'vacations';
  // Home, mixed business pages, administration and unknown future worlds keep
  // the full original cascade until their own dependency inventory is proven.
  return 'all';
}
