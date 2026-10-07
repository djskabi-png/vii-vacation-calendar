import assert from "node:assert/strict";
import test from "node:test";
import { supplierContactNumber } from "../app/lib/supplier-contact.ts";

test("supplier contact removes invisible direction marks without changing the number", () => {
  assert.equal(supplierContactNumber("\u200e050-1234567\u200f"), "050-1234567");
  assert.equal(supplierContactNumber("0501234567\u202c\u200f"), "0501234567");
});

test("supplier contact rejects absent or non-phone fields", () => {
  assert.equal(supplierContactNumber(null), undefined);
  assert.equal(supplierContactNumber("https://wa.me/972501234567"), undefined);
  assert.equal(supplierContactNumber(""), undefined);
});
