import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export type RequestCatalogReader = <T>(world: SupplierCatalogWorld) => Promise<T[]>;

/** Create inside one server render, never at module/process scope. A rejected
 * read is shared only within that render; the next request starts fresh. */
export function createRequestCatalogReader(load: (world: SupplierCatalogWorld) => Promise<unknown[]>): RequestCatalogReader {
  const reads = new Map<SupplierCatalogWorld, Promise<unknown[]>>();
  return <T>(world: SupplierCatalogWorld) => {
    if (!reads.has(world)) reads.set(world, Promise.resolve().then(() => load(world)));
    return reads.get(world)! as Promise<T[]>;
  };
}
