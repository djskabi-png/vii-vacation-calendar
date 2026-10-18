const WORLDS = new Set(["vacations", "events", "rooms", "spa"]);
const RUN_STATUSES = new Set(["requested", "running", "accepted", "rejected", "failed", "skipped"]);

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`invalid_${label}`);
  return value;
}

function requireWorld(value) {
  if (typeof value !== "string" || !WORLDS.has(value)) throw new Error("invalid_world");
  return value;
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new Error(`invalid_${label}`);
  return value;
}

function requireCount(value, label, allowNull = true) {
  if (value == null && allowNull) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_${label}`);
  return value;
}

function requireTimestamp(value, label, allowNull = true) {
  if (value == null && allowNull) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`invalid_${label}`);
  return value;
}

function parseStoredJson(value, label, allowNull = false) {
  if (value == null && allowNull) return null;
  if (typeof value !== "string") throw new Error(`invalid_${label}`);
  try { return jsonValue(JSON.parse(value), label); } catch { throw new Error(`invalid_${label}`); }
}

function jsonValue(value, label, allowNull = false) {
  if (value === null && allowNull) return null;
  if (value === undefined) return allowNull ? null : (() => { throw new Error(`invalid_${label}`); })();
  try {
    const encoded = JSON.stringify(value);
    return JSON.parse(encoded);
  } catch {
    throw new Error(`invalid_${label}`);
  }
}

export function convertCatalogSnapshot(input) {
  if (!input || typeof input !== "object") throw new Error("invalid_snapshot");
  const { runs, entries, states } = input;
  if (!Array.isArray(runs) || !Array.isArray(entries) || !Array.isArray(states)) throw new Error("invalid_snapshot_shape");

  const runIds = new Set();
  const runRows = runs.map((row) => {
    const id = requireString(row.id, "run_id");
    if (runIds.has(id)) throw new Error("duplicate_run_id");
    runIds.add(id);
    const world = requireWorld(row.world);
    if (typeof row.source !== "string" || row.source.trim() === "") throw new Error("invalid_source");
    if (!RUN_STATUSES.has(row.status)) throw new Error("invalid_run_status");
    const startedAt = requireTimestamp(row.startedAt, "started_at", false);
    const finishedAt = requireTimestamp(row.finishedAt, "finished_at");
    if (finishedAt && Date.parse(finishedAt) < Date.parse(startedAt)) throw new Error("invalid_finished_at");
    return {
      id, world, source: row.source, status: row.status, started_at: startedAt,
      finished_at: finishedAt, before_count: requireCount(row.beforeCount, "before_count"),
      candidate_count: requireCount(row.candidateCount, "candidate_count"), added_count: requireCount(row.addedCount, "added_count"),
      changed_count: requireCount(row.changedCount, "changed_count"), removed_count: requireCount(row.removedCount, "removed_count"),
      error_code: row.errorCode ?? null,
      diagnostics_json: parseStoredJson(row.diagnosticsJson, "diagnostics_json", true), schema_version: 1,
    };
  });

  const entryKeys = new Set();
  const entryIds = new Set();
  const entryRows = entries.map((row) => {
    const id = requireString(row.id, "entry_id");
    if (entryIds.has(id)) throw new Error("duplicate_entry_id");
    entryIds.add(id);
    const runId = requireString(row.runId, "run_id");
    if (!runIds.has(runId)) throw new Error("orphan_entry_run");
    const world = requireWorld(row.world);
    const run = runRows.find((candidate) => candidate.id === runId);
    if (!run) throw new Error("orphan_entry_run");
    if (run.world !== world) throw new Error("entry_world_mismatch");
    const supplierId = requireInteger(row.supplierId, "supplier_id");
    if (supplierId <= 0) throw new Error("invalid_supplier_id");
    const key = `${runId}\u0000${world}\u0000${supplierId}`;
    if (entryKeys.has(key)) throw new Error("duplicate_entry");
    entryKeys.add(key);
    return {
      id, run_id: runId, world, supplier_id: supplierId,
      summary_json: parseStoredJson(row.summaryJson, "summary_json"),
      detail_json: parseStoredJson(row.detailJson, "detail_json", true),
      provenance_json: jsonValue(row.provenance ?? {
        source: "existing_d1_catalog",
        source_run_id: runId,
        source_world: world,
        source_supplier_id: supplierId,
      }, "provenance"),
      schema_version: 1,
    };
  });

  const stateWorlds = new Set();
  const stateRows = states.map((row) => {
    const world = requireWorld(row.world);
    if (stateWorlds.has(world)) throw new Error("duplicate_state_world");
    stateWorlds.add(world);
    if (row.activeRunId != null && !runIds.has(row.activeRunId)) throw new Error("orphan_active_run");
    return {
      world, active_run_id: row.activeRunId ?? null,
      accepted_at: requireTimestamp(row.acceptedAt, "accepted_at"),
      active_count: requireCount(row.activeCount ?? 0, "active_count", false),
      lock_run_id: row.lockRunId ?? null, lock_until: requireTimestamp(row.lockUntil, "lock_until"),
      schema_version: 1,
    };
  });

  for (const state of stateRows) {
    const active = state.active_run_id ? runRows.find((run) => run.id === state.active_run_id) : null;
    const activeEntries = state.active_run_id ? entryRows.filter((entry) => entry.run_id === state.active_run_id && entry.world === state.world) : [];
    if (state.active_run_id && (!active || active.world !== state.world || active.status !== "accepted" || !active.finished_at)) throw new Error("invalid_active_generation");
    if (state.active_run_id && activeEntries.length !== state.active_count) throw new Error("active_generation_count_mismatch");
    if (state.lock_run_id) {
      const lock = runRows.find((run) => run.id === state.lock_run_id);
      if (!lock || lock.world !== state.world || !["requested", "running"].includes(lock.status)) throw new Error("invalid_lock_reference");
      if (!state.lock_until || Date.parse(state.lock_until) <= Date.now()) throw new Error("expired_lock_reference");
    } else if (state.lock_until) throw new Error("orphan_lock_until");
  }

  return { runs: runRows, entries: entryRows, states: stateRows };
}

export function roundTripCatalogSnapshot(snapshot) {
  const converted = convertCatalogSnapshot(snapshot);
  return JSON.parse(JSON.stringify(converted));
}
