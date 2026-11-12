import { NextRequest, NextResponse } from "next/server";
import { publicCatalogDetail } from "../../../lib/public-catalog-read.ts";
import { supplierPlaceDetail, type SupplierPlaceDetail } from "../../../data/supplier-place-detail";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const world = request.nextUrl.searchParams.get("world");
  const supplierId = Number(request.nextUrl.searchParams.get("id"));
  if ((world !== "vacations" && world !== "events") || !Number.isSafeInteger(supplierId) || supplierId <= 0) {
    return NextResponse.json({ error: "invalid_place" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const accepted = await publicCatalogDetail<SupplierPlaceDetail>(world, supplierId);
  if (!accepted) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": CACHE_CONTROL } });

  const agreement = supplierPlaceDetail(`${world === "vacations" ? "vacation" : "event"}-${supplierId}`);
  const detail = agreement?.policy.cancellationTerms
    ? { ...accepted, policy: { ...accepted.policy, cancellationTerms: agreement.policy.cancellationTerms } }
    : accepted;
  return NextResponse.json({ detail }, {
    headers: { "Cache-Control": CACHE_CONTROL, "X-VII-Detail-Source": "accepted-catalog" },
  });
}
