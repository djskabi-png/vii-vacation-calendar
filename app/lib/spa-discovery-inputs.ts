/** Both accepted catalog and read-only availability begin together. */
export async function spaDiscoveryInputs<C, A>(readCatalog: () => Promise<C>, readAvailability: () => Promise<A>, budgetMs = 1200) {
  const started = performance.now();
  let catalogMs = 0, availabilityMs = 0;
  const catalog = Promise.resolve().then(readCatalog).then(value => { catalogMs = performance.now() - started; return value; });
  const refresh = Promise.resolve().then(readAvailability).catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const available = Promise.race([refresh, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), budgetMs); })])
    .then(value => { availabilityMs = performance.now() - started; return value; });
  try {
    const [sites, cached] = await Promise.all([catalog, available]);
    return { sites, cached, refresh, catalogMs: Math.round(catalogMs), availabilityMs: Math.round(availabilityMs), elapsedMs: Math.round(performance.now() - started) };
  } finally { if (timer) clearTimeout(timer); }
}
