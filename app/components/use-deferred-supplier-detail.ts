"use client";

import { useEffect, useState } from "react";
import type { SupplierPlaceDetail } from "../data/supplier-place-detail";

const resolvedDetails = new Map<string, SupplierPlaceDetail>();
const pendingDetails = new Map<string, Promise<SupplierPlaceDetail | undefined>>();

function fetchDetail(url: string) {
  const resolved = resolvedDetails.get(url);
  if (resolved) return Promise.resolve(resolved);
  const pending = pendingDetails.get(url);
  if (pending) return pending;
  const request = fetch(url, { credentials: "same-origin", cache: "force-cache", headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const payload = await response.json() as { detail?: SupplierPlaceDetail };
      if (!payload.detail) return undefined;
      resolvedDetails.set(url, payload.detail);
      return payload.detail;
    })
    .catch(() => undefined)
    .finally(() => pendingDetails.delete(url));
  pendingDetails.set(url, request);
  return request;
}

export function useDeferredSupplierDetail(url?: string, initial?: SupplierPlaceDetail) {
  const [detail, setDetail] = useState(initial);

  useEffect(() => {
    if (initial) {
      setDetail(initial);
      return;
    }
    if (!url) return;
    let active = true;
    void fetchDetail(url).then((value) => {
      if (active && value) setDetail(value);
    });
    return () => { active = false; };
  }, [initial, url]);

  return detail;
}
