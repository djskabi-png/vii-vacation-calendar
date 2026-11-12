import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const homeSource = readFileSync(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const discoverySource = readFileSync(new URL("../app/lib/discovery-client-cache.ts", import.meta.url), "utf8");

function callbackAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `callback marker missing: ${marker}`);
  const file = ts.createSourceFile("home-live-deals.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(file).endsWith(".catch") && ts.isArrowFunction(node.arguments[0]) && (node.getStart(file) >= start || node.arguments[0].getText(file).includes(marker))) found ??= node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(found, `catch callback missing after ${marker}`);
  const code = ts.transpileModule(`(${found.getText(file)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(`return ${code}`)();
}

test("home deals external AbortError reaches recovery, cleanup abort does not", () => {
  const callback = callbackAfter(homeSource, "const request = mode");
  const calls = [];
  const recover = (value) => calls.push(value);
  // Evaluate the actual callback body with the component's runtime variables.
  new Function("controller", "recover", `return (${callback.toString()})()` )({ signal: { aborted: false } }, recover);
  assert.deepEqual(calls, [undefined]);
});

test("home deals ignores only an abort caused by its own effect cleanup", () => {
  const callback = callbackAfter(homeSource, "const request = mode");
  const calls = [];
  new Function("controller", "recover", `return (${callback.toString()})()` )({ signal: { aborted: true } }, value => calls.push(value));
  assert.deepEqual(calls, []);
});

test("holiday-list external AbortError reaches error state", () => {
  const callback = callbackAfter(homeSource, "setHolidayState(\"error\")");
  const errors = [];
  new Function("controller", "setHolidayState", `return (${callback.toString()})()` )({ signal: { aborted: false } }, value => errors.push(value));
  assert.deepEqual(errors, ["error"]);
});

test("discoveryJson preserves an external AbortError as a reachable rejection", async () => {
  const code = ts.transpileModule(discoverySource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", code)(module, module.exports);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new DOMException("provider abort", "AbortError"); };
    await assert.rejects(module.exports.discoveryJson("/probe", "qa", { retries: 0, timeoutMs: 100 }), error => error?.name === "AbortError");
  } finally { globalThis.fetch = originalFetch; }
});

test("the regression is real against the candidate parent baseline", () => {
  const baseline = execFileSync("git", ["show", "fb4f7f6c9f1e27075397ce61190179e2bbd8f6ea:app/components/home-live-deals.tsx"], { encoding: "utf8" });
  const oldCallback = callbackAfter(baseline, "discoveryJson<ResponseData>(url");
  const oldCalls = [];
  new Function("error", "setHolidayState", "recover", `return (${oldCallback.toString()})(error)`)(new DOMException("provider abort", "AbortError"), value => oldCalls.push(value), value => oldCalls.push(value));
  assert.deepEqual(oldCalls, [], "baseline ignored external AbortError and left loading unresolved");
});
