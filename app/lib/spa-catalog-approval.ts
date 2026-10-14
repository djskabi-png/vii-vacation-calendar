import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";

// Gal confirmed on 2026-10-14 that this exact Spa Plus generation is the new
// commercial source of truth. The exception is deliberately fingerprinted so
// it cannot approve a later, unrelated catalog collapse.
const approvedRemovedPackages = new Set([
  "25:6759", "25:6760", "31:6758", "31:6761", "31:6762", "31:6764",
  "179:6778", "179:6781", "231:3456", "231:6766", "231:6768", "231:6770", "231:6771",
  "246:6785", "246:6786", "246:6787", "246:6788", "267:6980", "267:6981", "267:7087", "267:7088",
  "356:6802", "356:6803", "356:6804", "356:6805", "398:6851", "398:6852", "398:6853", "398:6854",
  "400:6811", "400:6812", "405:6815", "405:6816", "405:6817", "405:6818",
  "406:6819", "406:6820", "406:6821", "406:6822", "415:6823", "415:6824", "415:6825", "415:6826",
  "421:6829", "421:6830", "429:5338", "429:5351", "429:5474", "429:6208", "429:6806", "429:6808", "429:6809", "429:6810",
  "445:7111", "445:7112", "445:7113", "445:7114", "456:6776", "456:6777",
  "472:6831", "472:6832", "472:6833", "472:6834", "500:6813", "500:6814",
  "507:6796", "507:6797", "507:6798", "507:6799", "508:6783", "508:6784",
  "509:6792", "509:6793", "509:6794", "509:6795", "522:6842", "522:6843", "522:7085", "522:7086",
  "523:6844", "523:6845", "543:6978", "543:6979", "548:7046", "548:7047", "548:7048", "548:7089",
  "553:7115", "553:7116", "554:7119", "554:7120", "554:7121", "554:7122",
]);

function packageIds(entry: SupplierCatalogEntry) {
  const packages = (entry.summary as { packages?: Array<{ id?: unknown }> }).packages;
  return Array.isArray(packages)
    ? packages.map((pack) => Number(pack.id)).filter((id) => Number.isSafeInteger(id) && id > 0)
    : [];
}

export function approvedSpaCatalogTransition(previous: SupplierCatalogEntry[], candidate: SupplierCatalogEntry[]) {
  if (previous.length !== 159 || candidate.length !== 160) return false;
  const before = new Map(previous.map((entry) => [entry.supplierId, entry]));
  const next = new Map(candidate.map((entry) => [entry.supplierId, entry]));
  if (before.size !== 159 || next.size !== 160 || !next.has(534)) return false;
  if ([...before.keys()].some((id) => !next.has(id))) return false;
  if ([...next.keys()].filter((id) => !before.has(id)).join(",") !== "534") return false;
  const removed: string[] = [];
  for (const [siteId, oldEntry] of before) {
    const current = new Set(packageIds(next.get(siteId)!));
    for (const packageId of packageIds(oldEntry)) {
      if (!current.has(packageId)) removed.push(`${siteId}:${packageId}`);
    }
  }
  const candidatePackages = candidate.reduce((total, entry) => total + packageIds(entry).length, 0);
  return candidatePackages === 919
    && removed.length === approvedRemovedPackages.size
    && removed.every((key) => approvedRemovedPackages.has(key));
}
