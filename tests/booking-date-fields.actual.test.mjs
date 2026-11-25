import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { parseCalendarDate } from "../app/lib/modern-date-model.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/components/booking-date-fields.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
const fields = {};
Function("require", "exports", outputText)(
  name => name === "../lib/modern-date-model" ? { parseCalendarDate } : require(name),
  fields,
);

function renderFields(Component, props) {
  const markup = renderToStaticMarkup(createElement("dl", { dir: "rtl" }, createElement(Component, { language: "he", ...props })));
  return [...JSDOM.fragment(markup).querySelectorAll("dl > div")].map(row => {
    const time = row.querySelector("time");
    return [row.querySelector("dt").textContent, row.querySelector("dd").textContent, time?.getAttribute("datetime"), time?.dir];
  });
}

test("Hebrew stay dates retain their order and isolate each dotted date across a year boundary", () => {
  const expected = [
    ["תאריך כניסה", "31.12.2026", "2026-12-31", "ltr"],
    ["תאריך יציאה", "02.01.2027", "2027-01-02", "ltr"],
  ];
  assert.deepEqual(renderFields(fields.BookingDateFields, { arrival: "2026-12-31", departure: "2027-01-02", stay: true }), expected);
  assert.deepEqual(renderFields(fields.SavedBookingDateFields, { value: "2026-12-31 עד 2027-01-02", stay: true }), expected);
});

test("an appointment shows one date and its time, and an absent date shows no empty label", () => {
  assert.deepEqual(renderFields(fields.BookingDateFields, { arrival: "2026-12-09", time: "09:30", stay: false }), [
    ["תאריך", "09.12.2026", "2026-12-09", "ltr"],
    ["שעה", "09:30", "09:30", "ltr"],
  ]);
  assert.deepEqual(renderFields(fields.BookingDateFields, { arrival: "", departure: "", stay: false }), []);
});
