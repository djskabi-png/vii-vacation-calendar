import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { supplierPhoneLink } from '../app/lib/supplier-contact.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function directHarness(language = 'he') {
  const events = [], jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { Phone() {} },
    '../i18n/locale-provider': { useSiteLanguage: () => ({ language }) },
    '../lib/supplier-contact': { supplierPhoneLink },
    '../lib/analytics': { trackPhoneClick: event => events.push(event) },
  };
  const exports = {};
  const source = ts.transpileModule(read('app/components/direct-phone-link.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', source)(id => { assert.ok(modules[id], id); return modules[id]; }, exports);
  return { render: exports.DirectPhoneLink, events };
}
const tracking = { placeId: 'vacation-test', placeName: 'Test', world: 'vacation', placement: 'property_card' };

test('supplier routing digits and formatting remain unchanged, with bidi marks removed', () => {
  assert.deepEqual(supplierPhoneLink('\u200e055-4318294\u200f'), { display: '055-4318294', href: 'tel:0554318294' });
  assert.deepEqual(supplierPhoneLink('+972 (55) 431-8294'), { display: '+972 (55) 431-8294', href: 'tel:+972554318294' });
  for (const value of [undefined, '', '-------', 'none', '050+123+4567', '+12345678901234567', 'tel:0554318294']) assert.equal(supplierPhoneLink(value), undefined);
});

test('all languages render the callable number immediately with isolation and local accessible label', () => {
  for (const language of ['he', 'en', 'ru', 'fr']) {
    const h = directHarness(language), node = h.render({ phone: '055-4318294', placeName: 'Test', tracking });
    assert.equal(node.type, 'a'); assert.equal(node.props.href, 'tel:0554318294');
    assert.match(node.props['aria-label'], /Test, 055-4318294/);
    if (language !== 'he') assert.doesNotMatch(node.props['aria-label'], /[\u0590-\u05ff]/);
    const number = node.props.children[1];
    assert.equal(number.type, 'bdi'); assert.equal(number.props.dir, 'ltr'); assert.equal(number.props.children, '055-4318294');
    assert.equal(number.props['data-no-translate'], true);
    assert.equal(node.props['aria-expanded'], undefined); assert.deepEqual(h.events, []);
    node.props.onClick(); assert.deepEqual(h.events, [tracking]);
  }
});

test('invalid and absent phone creates no callable placeholder', () => {
  const h = directHarness();
  for (const phone of [undefined, '', '-------', 'not-a-number']) assert.equal(h.render({ phone, placeName: 'Test' }), null);
});

test('click measurement is consented intent only and cannot block native dialing', () => {
  const source = ts.transpileModule(read('app/lib/analytics.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const consent of ['all', 'essential', undefined, 'blocked-storage']) {
    const sent = [], exports = {}, window = { localStorage: { getItem() { if (consent === 'blocked-storage') throw Error('blocked'); return consent; } }, location: { pathname: '/business', search: '?from=2026-10-20' }, dispatchEvent: event => sent.push(event) };
    new Function('exports', 'window', 'CustomEvent', source)(exports, window, class { constructor(type, value) { this.type = type; this.detail = value.detail; } });
    assert.doesNotThrow(() => exports.trackPhoneClick(tracking));
    if (consent === 'all') {
      assert.equal(window.dataLayer.length, 1); assert.equal(window.dataLayer[0].event, 'vii_phone_click');
      assert.equal(window.dataLayer[0].page_path, '/business');
      assert.equal(sent[0].type, 'vii:phone-click');
      assert.doesNotMatch(JSON.stringify(window.dataLayer), /phone_reveal|call_completed|0554318294|055-4318294/);
    } else { assert.equal(window.dataLayer, undefined); assert.equal(sent.length, 0); }
  }
});

test('every formerly gated caller uses the shared direct link without reveal state', () => {
  for (const file of ['app/components/property-card.tsx', 'app/components/card-contact-actions.tsx', 'app/components/floating-contact-actions.tsx', 'app/components/detail-sticky-dock.tsx', 'app/business/client-page.tsx', 'app/events/place/client-page.tsx', 'app/discover/place/client-page.tsx', 'app/booking/client-page.tsx']) {
    const text = read(file);
    assert.match(text, /<DirectPhoneLink/, file);
    assert.doesNotMatch(text, /phoneVisible|phoneRevealed|setPhoneVisible|setPhoneRevealed|trackPhoneReveal|הצגת מספר|לחצו להצגת המספר/, file);
  }
  const demo = read('app/components/listing-contact-preview.tsx');
  assert.doesNotMatch(demo, /phoneVisible|setPhoneVisible|tel:/);
  assert.match(demo, /<small>\{labels.exampleNumber\}<\/small>/);
  assert.match(read('app/booking/client-page.tsx'), /supplierPhoneLink\(props.phone\) \? <DirectPhoneLink/);
});

test('all public TSX source is scanned for remaining reveal control state', () => {
  function scan(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? scan(join(path, e.name)) : e.name.endsWith('.tsx') ? [join(path, e.name)] : []); }
  for (const file of scan(fileURLToPath(new URL('../app', import.meta.url)))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /setPhoneVisible|setPhoneRevealed|לחצו להצגת המספר/, file);
  }
});
