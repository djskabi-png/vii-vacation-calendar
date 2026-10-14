import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import { approvedSpaCatalogTransition } from "../app/lib/spa-catalog-approval.ts";

const removals = new Set([
  "25:6759", "25:6760", "31:6758", "31:6761", "31:6762", "31:6764", "179:6778", "179:6781",
  "231:3456", "231:6766", "231:6768", "231:6770", "231:6771", "246:6785", "246:6786", "246:6787", "246:6788",
  "267:6980", "267:6981", "267:7087", "267:7088", "356:6802", "356:6803", "356:6804", "356:6805",
  "398:6851", "398:6852", "398:6853", "398:6854", "400:6811", "400:6812", "405:6815", "405:6816", "405:6817", "405:6818",
  "406:6819", "406:6820", "406:6821", "406:6822", "415:6823", "415:6824", "415:6825", "415:6826", "421:6829", "421:6830",
  "429:5338", "429:5351", "429:5474", "429:6208", "429:6806", "429:6808", "429:6809", "429:6810",
  "445:7111", "445:7112", "445:7113", "445:7114", "456:6776", "456:6777", "472:6831", "472:6832", "472:6833", "472:6834",
  "500:6813", "500:6814", "507:6796", "507:6797", "507:6798", "507:6799", "508:6783", "508:6784",
  "509:6792", "509:6793", "509:6794", "509:6795", "522:6842", "522:6843", "522:7085", "522:7086",
  "523:6844", "523:6845", "543:6978", "543:6979", "548:7046", "548:7047", "548:7048", "548:7089",
  "553:7115", "553:7116", "554:7119", "554:7120", "554:7121", "554:7122",
]);

function approvedCandidate() {
  const previous = catalog.sites.map((summary) => ({ supplierId: summary.id, summary }));
  const candidate = previous.map((entry) => ({ ...entry, summary: { ...entry.summary,
    packages: entry.summary.packages.filter((pack) => !removals.has(`${entry.supplierId}:${pack.id}`)) } }));
  candidate.push({ supplierId: 534, summary: { id: 534, title: "ספא חדש", city: "חיפה",
    packages: Array.from({ length: 7 }, (_, index) => ({ id: 90001 + index })) } });
  return { previous, candidate };
}

test("accepts only Gal's exact approved 160-site and 919-package Spa transition", () => {
  const { previous, candidate } = approvedCandidate();
  assert.equal(candidate.reduce((total, entry) => total + entry.summary.packages.length, 0), 919);
  assert.equal(approvedSpaCatalogTransition(previous, candidate), true);
});

test("does not turn the one approved Spa transition into a general removal bypass", () => {
  const { previous, candidate } = approvedCandidate();
  candidate[0] = { ...candidate[0], summary: { ...candidate[0].summary, packages: candidate[0].summary.packages.slice(1) } };
  assert.equal(approvedSpaCatalogTransition(previous, candidate), false);
  assert.equal(approvedSpaCatalogTransition(previous, previous.slice(0, 100)), false);
});
