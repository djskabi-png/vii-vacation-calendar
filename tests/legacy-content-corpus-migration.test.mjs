import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const ledger = JSON.parse(readFileSync(new URL("../project_knowledge/legacy-content-snapshot-20261114/legacy-content-migration-ledger.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus-archive-manifest.json", import.meta.url), "utf8"));
const vacation = JSON.parse(readFileSync(new URL("../app/data/legacy-search-page-publications.json", import.meta.url), "utf8"));
const events = JSON.parse(readFileSync(new URL("../app/data/legacy-event-search-pages.json", import.meta.url), "utf8"));
const redirects = JSON.parse(readFileSync(new URL("../app/data/legacy-redirect-inventory.json", import.meta.url), "utf8"));

test("the live legacy content corpus is archived and every in-scope URL has a destination", () => {
  assert.equal(manifest.rows, 4894);
  assert.ok(manifest.sourceBytes > manifest.archiveBytes);
  assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.archiveSha256, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(new URL(`../${manifest.archive}`, import.meta.url)), true);
  assert.equal(ledger.counts.sourceFailures, 0);
  assert.equal(ledger.counts.unmapped, 0);
  assert.equal(ledger.counts.mapped, ledger.counts.uniqueInScope);
});

test("all migrated search content is editable and preserves owned body and FAQ content", () => {
  assert.equal(ledger.counts.adminEditable, vacation.pages.length + vacation.aliases.length + events.length);
  assert.equal(ledger.counts.exactBodyParity, ledger.counts.sourceManagedBody);
  assert.equal(ledger.counts.exactFaqParity, ledger.counts.sourceManagedFaq);
  assert.ok(ledger.counts.exactBodyParity >= 1400);
  assert.ok(ledger.counts.exactFaqParity >= 1200);
});

test("legacy content routes are direct redirects and none remain in the gone inventory", () => {
  const gone = new Set(redirects.gone || []);
  for (const row of ledger.rows.filter((item) => ["vacation-search", "event-search"].includes(item.routeFamily))) {
    assert.equal(row.redirectRegistered, true, row.sourcePath);
    assert.ok(row.target, row.sourcePath);
    assert.equal(gone.has(row.sourcePath), false, row.sourcePath);
  }
  assert.equal(redirects.redirects["/s"], "/vacations");
  assert.equal(redirects.redirects["/events/s"], "/events");
});
