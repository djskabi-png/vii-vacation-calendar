/** Only the complete public discovery context used by real place-card links.
 * This grants document-cache eligibility, never price/booking authority. */
export function publicBusinessContext(url: URL) {
  const path = (url.pathname.endsWith('.rsc') ? url.pathname.slice(0, -4) : url.pathname)
    .replace(/^\/(?:en|ru|fr)(?=\/|$)/, '');
  if (path !== '/business') return false;
  const params = url.searchParams;
  for (const key of ['id', 'from', 'till', 'guests', 'roomID', 'price']) {
    if (params.getAll(key).length !== 1) return false;
  }
  if (!/^(?:vacation|event)-[1-9]\d{0,8}$/.test(params.get('id')!)) return false;
  if (!/^[1-9]\d{0,8}$/.test(params.get('roomID')!)) return false;
  if (!/^[1-9]\d?$/.test(params.get('guests')!) || Number(params.get('guests')) > 50) return false;
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(params.get('price')!)) return false;
  const price = Number(params.get('price'));
  if (price <= 0 || price > 1_000_000) return false;
  const dates = ['from', 'till'].map(key => params.get(key)!);
  if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return false;
  return dates[1] > dates[0];
}
