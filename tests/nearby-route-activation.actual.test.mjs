import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";

function harness() {
  const cells = []; let index = 0; let resolve; let reject; let requests = 0; const replaces = [];
  const jsx = (type, props) => ({ type, props });
  const react = { useState(value) { const i = index++; if (!(i in cells)) cells[i] = value; return [cells[i], next => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }]; } };
  const deps = { "../i18n/locale-provider": {useSiteLanguage:()=>({language:"he",translate:value=>value})}, react, "react/jsx-runtime": { jsx, jsxs: jsx }, "lucide-react": { MapPin: "pin" }, "next/navigation": { useRouter: () => ({ replace: (href, options) => replaces.push({ href, options }) }), usePathname: () => "/spas/near-me", useSearchParams: () => new URLSearchParams("features=pool&date=2026-11-20") }, "./use-nearby-sort": { requestNearbyOrigin: () => { requests++; return new Promise((a, b) => { resolve = a; reject = b; }); } } };
  const source = readFileSync(new URL("../app/components/nearby-route-activation.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {}; new Function("require", "exports", code)(id => deps[id] || {}, exports);
  return { render: props => { index = 0; return exports.NearbyRouteActivation(props); }, resolve: () => resolve({ lat: 32, lng: 34 }), reject: () => reject(new Error("denied")), get requests() { return requests; }, replaces };
}
const click = () => ({ preventDefault() {} });
const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
const findRole = (node, role) => node && (node.props?.role === role ? node : (Array.isArray(node.props?.children) ? node.props.children.map(child => findRole(child, role)).find(Boolean) : findRole(node.props?.children, role)));

test("nearby CTA does not request on mount, guards duplicate clicks, and preserves query state", async () => {
  const h = harness(); let tree = h.render({}); assert.equal(h.requests, 0);
  const button = tree.props.children[1]; button.props.onClick(click()); tree = h.render({}); tree.props.children[1].props.onClick(click()); assert.equal(h.requests, 1);
  h.resolve(); await settle(); assert.equal(h.replaces.length, 1); assert.equal(h.replaces[0].href, "/spas/near-me?features=pool&date=2026-11-20&sort=nearest"); assert.deepEqual(h.replaces[0].options, { scroll: false });
});

test("nearby CTA exposes denial and allows a clean retry", async () => {
  const h = harness(); let tree = h.render({}); tree.props.children[1].props.onClick(click()); h.reject(); await settle();
  tree = h.render({}); assert.ok(findRole(tree, "status")); assert.equal(h.requests, 1);
  tree.props.children[1].props.onClick(click()); assert.equal(h.requests, 2); h.resolve(); await settle(); assert.equal(h.replaces.length, 1);
});
