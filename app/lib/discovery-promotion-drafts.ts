import type { D1Database } from "../../types/cloudflare-runtime";
import { readSupplierCatalogEntry, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export const promotionWorlds = ["vacations", "events", "rooms", "spa"] as const;
export const promotionKinds = ["manual", "new_place", "ending_contract"] as const;
export type PromotionKind = typeof promotionKinds[number];
export type PromotionStatus = "draft" | "archived";

export type PromotionDraft = {
  eventId: string;
  campaignId: string;
  version: number;
  world: SupplierCatalogWorld;
  supplierId: number;
  placeName: string;
  kind: PromotionKind;
  weight: number;
  startsOn: string;
  endsOn: string;
  contractEndsOn: string | null;
  contractSource: string | null;
  note: string;
  status: PromotionStatus;
  actorEmail: string;
  savedAt: string;
};

export class PromotionDraftError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shortText(value: unknown, limit: number) {
  return typeof value === "string" && value.trim().length <= limit ? value.trim() : null;
}

export function parsePromotionDraft(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PromotionDraftError("invalid_request");
  const input = value as Record<string, unknown>;
  if (!promotionWorlds.includes(input.world as SupplierCatalogWorld)) throw new PromotionDraftError("invalid_world");
  if (!Number.isSafeInteger(input.supplierId) || Number(input.supplierId) < 1) throw new PromotionDraftError("invalid_supplier_id");
  if (!promotionKinds.includes(input.kind as PromotionKind)) throw new PromotionDraftError("invalid_kind");
  if (!Number.isInteger(input.weight) || Number(input.weight) < 1 || Number(input.weight) > 5) {
    throw new PromotionDraftError("invalid_weight");
  }
  if (!validDate(input.startsOn) || !validDate(input.endsOn) || input.startsOn > input.endsOn) {
    throw new PromotionDraftError("invalid_period");
  }
  const contractEndsOn = input.contractEndsOn === "" || input.contractEndsOn == null ? null : input.contractEndsOn;
  const contractSource = input.contractSource === "" || input.contractSource == null ? null : shortText(input.contractSource, 200);
  if (contractEndsOn !== null && !validDate(contractEndsOn)) throw new PromotionDraftError("invalid_contract_end");
  if (input.contractSource && contractSource === null) throw new PromotionDraftError("invalid_contract_source");
  if (contractEndsOn && !contractSource) throw new PromotionDraftError("contract_source_required");
  if (input.kind === "ending_contract" && !contractEndsOn) throw new PromotionDraftError("contract_end_required");
  if (input.status !== "draft" && input.status !== "archived") throw new PromotionDraftError("invalid_status");
  const note = shortText(input.note, 500);
  if (note === null) throw new PromotionDraftError("invalid_note");
  const campaignId = input.campaignId == null ? null : input.campaignId;
  if (campaignId !== null && (typeof campaignId !== "string" || !/^[0-9a-f-]{36}$/i.test(campaignId))) {
    throw new PromotionDraftError("invalid_campaign_id");
  }
  const expectedVersion = input.expectedVersion == null ? null : input.expectedVersion;
  if (campaignId && (!Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 1)) {
    throw new PromotionDraftError("version_required");
  }
  if (!campaignId && expectedVersion !== null) throw new PromotionDraftError("invalid_version");
  if (typeof input.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.requestId)) {
    throw new PromotionDraftError("invalid_request_id");
  }
  return {
    requestId: input.requestId,
    campaignId: campaignId as string | null,
    expectedVersion: expectedVersion as number | null,
    world: input.world as SupplierCatalogWorld,
    supplierId: input.supplierId as number,
    kind: input.kind as PromotionKind,
    weight: input.weight as number,
    startsOn: input.startsOn as string,
    endsOn: input.endsOn as string,
    contractEndsOn: contractEndsOn as string | null,
    contractSource,
    note,
    status: input.status as PromotionStatus,
  };
}

const columns = `event_id AS eventId, campaign_id AS campaignId, version, world,
  supplier_id AS supplierId, place_name AS placeName, kind, weight,
  starts_on AS startsOn, ends_on AS endsOn, contract_ends_on AS contractEndsOn,
  contract_source AS contractSource, note, status, actor_email AS actorEmail, saved_at AS savedAt`;

export async function readPromotionDraftDashboard(db: D1Database) {
  const [drafts, activity] = await Promise.all([
    db.prepare(`SELECT ${columns} FROM discovery_promotion_draft_events e
      WHERE version = (SELECT MAX(version) FROM discovery_promotion_draft_events
        WHERE campaign_id = e.campaign_id)
      ORDER BY saved_at DESC LIMIT 200`).all<PromotionDraft>(),
    db.prepare(`SELECT ${columns} FROM discovery_promotion_draft_events
      ORDER BY saved_at DESC LIMIT 40`).all<PromotionDraft>(),
  ]);
  return { drafts: drafts.results, activity: activity.results, publicRankingEnabled: false };
}

export async function savePromotionDraft(db: D1Database, raw: unknown, actorEmail: string) {
  const input = parsePromotionDraft(raw);
  const previousRequest = await db.prepare(`SELECT ${columns} FROM discovery_promotion_draft_events
    WHERE event_id = ?`).bind(input.requestId).first<PromotionDraft>();
  if (previousRequest) {
    if (previousRequest.actorEmail !== actorEmail ||
      (input.campaignId && previousRequest.campaignId !== input.campaignId) ||
      previousRequest.world !== input.world || previousRequest.supplierId !== input.supplierId ||
      previousRequest.kind !== input.kind || previousRequest.weight !== input.weight ||
      previousRequest.startsOn !== input.startsOn || previousRequest.endsOn !== input.endsOn ||
      previousRequest.contractEndsOn !== input.contractEndsOn || previousRequest.contractSource !== input.contractSource ||
      previousRequest.note !== input.note || previousRequest.status !== input.status ||
      (input.expectedVersion !== null && previousRequest.version !== input.expectedVersion + 1)) {
      throw new PromotionDraftError("request_id_conflict", 409);
    }
    return previousRequest;
  }
  const current = input.campaignId ? await db.prepare(`SELECT ${columns} FROM discovery_promotion_draft_events
    WHERE campaign_id = ? ORDER BY version DESC LIMIT 1`).bind(input.campaignId).first<PromotionDraft>() : null;
  if (input.campaignId && (!current || current.version !== input.expectedVersion)) {
    throw new PromotionDraftError("version_conflict", 409);
  }
  if (current && (current.world !== input.world || current.supplierId !== input.supplierId)) {
    throw new PromotionDraftError("place_identity_locked");
  }
  const place = await readSupplierCatalogEntry(db, input.world, input.supplierId);
  if (!place && !(current && input.status === "archived")) {
    throw new PromotionDraftError("place_not_published", 409);
  }
  const summary = place?.summary as Record<string, unknown> | undefined;
  const placeName = summary ? (typeof summary.name === "string" ? summary.name.trim()
    : typeof summary.title === "string" ? summary.title.trim() : "") : current?.placeName || "";
  if (!placeName) throw new PromotionDraftError("place_name_missing", 409);
  const row: PromotionDraft = {
    eventId: input.requestId, campaignId: input.campaignId || crypto.randomUUID(),
    version: (current?.version || 0) + 1, world: input.world, supplierId: input.supplierId,
    placeName, kind: input.kind, weight: input.weight, startsOn: input.startsOn, endsOn: input.endsOn,
    contractEndsOn: input.contractEndsOn, contractSource: input.contractSource, note: input.note,
    status: input.status, actorEmail, savedAt: new Date().toISOString(),
  };
  try {
    await db.prepare(`INSERT INTO discovery_promotion_draft_events
      (event_id, campaign_id, version, world, supplier_id, place_name, kind, weight,
       starts_on, ends_on, contract_ends_on, contract_source, note, status, actor_email, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(row.eventId, row.campaignId, row.version, row.world, row.supplierId, row.placeName,
        row.kind, row.weight, row.startsOn, row.endsOn, row.contractEndsOn, row.contractSource,
        row.note, row.status, row.actorEmail, row.savedAt).run();
  } catch (error) {
    if (error instanceof Error && /unique constraint/i.test(error.message)) {
      throw new PromotionDraftError("version_conflict", 409);
    }
    throw error;
  }
  return row;
}
