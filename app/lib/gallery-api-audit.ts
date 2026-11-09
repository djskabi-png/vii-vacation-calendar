import { buildAcceptedGalleryContract, buildApiGalleryContract, compareGalleryContracts, type GalleryContract } from "./supplier-gallery-contract.ts";

export type GalleryAuditItem = {
  world: GalleryContract["world"];
  supplierId: string;
  status: "match" | "mismatch" | "unverified";
  issues: string[];
  api: GalleryContract;
  accepted: GalleryContract;
};

/** Pure API-vs-accepted comparison. Persistence and authorization stay in the admin route. */
export async function auditGalleryItem(input: {
  world: GalleryContract["world"];
  supplierId: string | number;
  api: unknown;
  acceptedEntry?: unknown;
  wireText?: string;
}): Promise<GalleryAuditItem> {
  let api: GalleryContract;
  try { api = await buildApiGalleryContract(input.world, input.supplierId, input.api, input.wireText); }
  catch { api = { world: input.world, supplierId: String(input.supplierId), entities: [], source: "api" }; }
  let accepted: GalleryContract;
  try { accepted = input.acceptedEntry === undefined
    ? { world: input.world, supplierId: String(input.supplierId), entities: [], source: "accepted" }
    : await buildAcceptedGalleryContract(input.world, input.acceptedEntry); }
  catch { accepted = { world: input.world, supplierId: String(input.supplierId), entities: [], source: "accepted" }; }
  const comparison = compareGalleryContracts(api, accepted);
  const status = !api.entities.length || !accepted.entities.length || comparison.issues.some(issue => issue.includes("unverified")) ? "unverified" : comparison.equal ? "match" : "mismatch";
  return { world: input.world, supplierId: String(input.supplierId), status, issues: comparison.issues, api, accepted };
}

export async function auditGalleryBatch(items: Array<Parameters<typeof auditGalleryItem>[0]>): Promise<GalleryAuditItem[]> {
  const results: GalleryAuditItem[] = [];
  for (const item of items) results.push(await auditGalleryItem(item));
  return results;
}
