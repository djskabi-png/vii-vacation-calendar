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

test("nearby route activation is intentionally empty after the route owns GPS activation", async () => {
  const h = harness(); assert.equal(h.render({}), null); assert.equal(h.requests, 0); assert.equal(h.replaces.length, 0);
});

test("nearby route activation does not render a duplicate denial/retry CTA", async () => {
  const h = harness(); assert.equal(h.render({}), null); assert.equal(h.requests, 0);
});
