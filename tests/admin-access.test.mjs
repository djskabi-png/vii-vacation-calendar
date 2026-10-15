import assert from "node:assert/strict";
import test from "node:test";

import { combineAdminEmails } from "../app/lib/admin-access.ts";

test("combines the protected admin list with an additive list", () => {
  assert.deepEqual(
    combineAdminEmails("owner@example.com,editor@example.com", "palombo.r@gmail.com"),
    ["owner@example.com", "editor@example.com", "palombo.r@gmail.com"],
  );
});

test("normalizes and de-duplicates admin addresses", () => {
  assert.deepEqual(
    combineAdminEmails(" Owner@Example.com ", "owner@example.com, PALOMBO.R@GMAIL.COM "),
    ["owner@example.com", "palombo.r@gmail.com"],
  );
});
