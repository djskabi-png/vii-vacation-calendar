import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  const pushes = [], events = [], refs = [];
  let now = 1000;
  const jsx = (type, props, ...children) => ({ type, props: { ...(props || {}), ...(children.length ? { children: children.length < 2 ? children[0] : children } : {}) } });
  const react = { useRef: value => { const ref = { current: value }; refs.push(ref); return ref; }, useState: value => [value, () => {}], useEffect: () => {}, useMemo: fn => fn() };
  const window = { performance: { now: () => now }, dispatchEvent: event => events.push(event), setTimeout: () => 0, addEventListener() {}, removeEventListener() {} };
  const router = { push: href => pushes.push(href) };
  const module = { exports: {} };
  const worldList = ["vacation", "spa", "events", "hourly", "trails", "attractions"].map(id => ({ id, href: `/${id}` }));
  vm.runInNewContext(code, { module, exports: module.exports, window, performance: window.performance, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, require: name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name === "next/link") return "Link";
    if (name === "next/navigation") return { useRouter: () => router };
    if (name.includes("world-navigation")) return { publicWorldNavigation: worldList, worlds: worldList };
    if (name.includes("locale-provider")) return { useSiteLanguage: () => ({ language: "he", translate: value => value }) };
    if (name.includes("locale-routing")) return { localizedPath: value => value };
    if (name.includes("vacation-landings")) return { cleanVacationPath: value => value };
    if (name.includes("spa-search-landings")) return { spaSearchHref: () => "/spas" , spaSearchStateFromValues: value => value };
    if (name.includes("world-search-landings")) return { eventSearchHref: () => "/events", hourlySearchHref: () => "/hourly" };
    if (name.includes("world-switcher-labels")) return { headerWorldLabel: () => "Vacation", headerWorldCompactLabel: () => "V", headerWorldOptions: () => worldList };
    if (name.includes("world-availability-provider")) return { useWorldAvailability: () => ({ enabled: () => true }) };
    if (name.includes("navigation-recovery")) return { NAVIGATION_START_EVENT: "vii:navigation-start" };
    if (name === "lucide-react") return { ChevronDown: () => null };
    throw new Error(`unexpected import ${name}`);
  }});
  function find(node, predicate, out = []) { if (!node) return out; if (Array.isArray(node)) return node.flatMap(child => find(child, predicate, out)); if (predicate(node)) out.push(node); return find(node.props?.children, predicate, out); }
  return { module, pushes, events, render: () => module.exports, find, advance: ms => { now += ms; } };
}

test("actual WorldSwitcher handlers announce once across pointerdown plus click", () => {
  const h = harness(); const tree = h.module.exports.WorldSwitcher({ active: "vacation" });
  const link = h.find(tree, node => node.props?.href === "/spa")[0] || h.find(tree, node => node.props?.href === "/spas")[0];
  const currentTarget = { getAttribute: name => name === "href" ? "/spa" : null };
  link.props.onPointerDown({ isPrimary: true, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, currentTarget, preventDefault() {} });
  link.props.onClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, currentTarget, preventDefault() {} });
  assert.deepEqual(h.pushes, ["/spa"]); assert.equal(h.events.length, 1); assert.equal(h.events[0].type, "vii:navigation-start");
});

test("actual WorldSwitcher modified click and post-window click semantics", () => {
  const h = harness(); const tree = h.module.exports.WorldSwitcher({ active: "vacation" });
  const link = h.find(tree, node => node.props?.href === "/spa")[0] || h.find(tree, node => node.props?.href === "/spas")[0]; const currentTarget = { getAttribute: () => "/spa" };
  link.props.onClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, currentTarget, preventDefault() {} });
  assert.equal(h.pushes.length, 0); h.advance(700);
  link.props.onClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, currentTarget, preventDefault() {} });
  assert.deepEqual(h.pushes, ["/spa"]); assert.equal(h.events.length, 1);
});

test("actual SearchWorldTabs rapid duplicate clicks push once and a different target still works", () => {
  const h = harness(); const tree = h.module.exports.SearchWorldTabs({ active: "vacation" });
  const links = h.find(tree, node => Boolean(node.props?.href)); const spa = links.find(node => node.props?.href === "/spa") || links.find(node => node.props?.href === "/spas"); const events = links.find(node => node.props?.href === "/events");
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault() {} };
  spa.props.onClick(click); spa.props.onClick(click); events.props.onClick(click);
  assert.deepEqual(h.pushes, ["/spa", "/events"]); assert.equal(h.events.length, 2);
});
