import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogDiagnosticLabels, catalogRunExplanation, catalogRunSourceLabel,
  catalogRunStatusLabel } from "../app/lib/catalog-sync-presentation.ts";

test("spa diagnostics use spa terminology and explain the removal safety stop", () => {
  const labels = catalogDiagnosticLabels("spa");
  assert.equal(labels.places.singular, "בית ספא");
  assert.equal(labels.children.plural, "חבילות ספא");
  const message = catalogRunExplanation("spa", "catalog_removal_requires_review", {
    before: 159,
    removedCount: 0,
    units: { before: 1005, candidate: 919, removedFromRetainedPlaces: 93,
      removedWithPlaces: 0, removedTotal: 93, removed: [], truncated: false },
  });
  assert.match(message, /93 חבילות ספא/);
  assert.match(message, /9\.3%/);
  assert.match(message, /הקטלוג הקודם נשמר/);
  assert.doesNotMatch(message, /חדרים|יחידות/);
});

test("each catalog world gets isolated child terminology", () => {
  assert.equal(catalogDiagnosticLabels("rooms").children.plural, "חדרים");
  assert.equal(catalogDiagnosticLabels("vacations").children.plural, "יחידות אירוח");
  assert.equal(catalogDiagnosticLabels("events").children.plural, "חללי אירוח");
});

test("spa transport and parsing failures remain spa-specific", () => {
  assert.match(catalogRunExplanation("spa", "invalid_spa_response"), /ספק הספא/);
  assert.match(catalogRunExplanation("spa", "spa_transport_error"), /מספק הספא/);
});

test("operator-facing run state and source are written in clear Hebrew", () => {
  assert.equal(catalogRunStatusLabel("rejected"), "נעצר לבדיקה");
  assert.equal(catalogRunStatusLabel("accepted"), "פורסם");
  assert.equal(catalogRunSourceLabel("manual"), "הפעלה ידנית");
  assert.equal(catalogRunSourceLabel("scheduled"), "עדכון מתוזמן");
});
