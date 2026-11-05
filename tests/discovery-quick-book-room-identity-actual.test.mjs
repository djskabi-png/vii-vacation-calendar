import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const deals = ts.createSourceFile('deals.tsx', read('app/components/home-live-deals.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const adapter = deals.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'dealAvailability');
assert.ok(adapter);
const adapterJs = ts.transpileModule(adapter.getText(deals).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const availability = new Function(adapterJs + '; return dealAvailability;')();
const cards = ts.createSourceFile('card.tsx', read('app/components/property-card.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let hrefNode;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(cards) === 'quickBookingHref') hrefNode = node.initializer;
  ts.forEachChild(node, visit);
}
visit(cards);
assert.ok(hrefNode);
const makeHref = new Function('quickBookingReady', 'selectedStay', 'property', 'selectedGuests', 'resolvedAvailability', 'return ' + hrefNode.getText(cards));

test('actual slider quote and shared card preserve supplier room through quick booking for all rail consumers', () => {
  // Public v800 showed a valid two-night offer but dropped roomID before the
  // checkout guard. Exercise the actual adapter AND actual card href expression.
  for (const nights of [1, 2, 3]) {
    const deal = { roomID: 9876, siteID: 11, from: '2026-11-05', till: `2026-11-0${5+nights}`, nights, total: 700*nights, priceGuests: 2, onlineBooking: true };
    const quote = availability(deal);
    const url = new URL(makeHref(true, { from: deal.from, till: deal.till }, { slug: 'vacation-11' }, '2', quote), 'https://vii.spaplus.co');
    assert.equal(url.searchParams.get('roomID'), '9876');
    assert.equal(url.searchParams.get('place'), 'vacation-11');
    assert.equal(url.searchParams.get('from'), deal.from);
    assert.equal(url.searchParams.get('till'), deal.till);
    assert.equal(url.searchParams.get('guests'), '2');
    assert.equal(quote.totalPrice, 700*nights);
  }
});

test('missing or invalid source rooms cannot create booking authority', () => {
  for (const roomID of [undefined, null, 0, -1, 1.5, '9876']) {
    const quote = availability({ roomID, from: '2026-11-05', till: '2026-11-06', nights: 1, total: 700, priceGuests: 2, onlineBooking: true });
    assert.equal(quote.bookingSupported, false);
    assert.equal(quote.supplierRoomID, undefined);
  }
});
