"use client";

import { useEffect, useMemo, useState } from "react";
import {promotionSupplierId,publicPromotionWeights,type PublicPromotionWeight,type PublicPromotionWorld} from '../lib/public-promotion-policy';

type World = PublicPromotionWorld;
type Weight = PublicPromotionWeight;
let snapshot: Weight[] | null = null;
let request: Promise<Weight[]> | null = null;
let checkedAt = 0;

export function readPublicPromotionWeights() {
  if (snapshot && Date.now()-checkedAt < 60_000) return Promise.resolve(snapshot);
  if (!request) request = fetch("/api/discovery-promotions", { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error("promotion_weights_unavailable");
    const body = await response.json() as { weights?: Weight[] };
    snapshot = publicPromotionWeights(body.weights);
    return snapshot;
  }).catch(() => { snapshot = []; return snapshot; }).finally(() => { checkedAt=Date.now(); request=null; });
  return request;
}

function usePromotionSnapshot() {
  const [weights, setWeights] = useState<Weight[]>(() => snapshot || []);
  useEffect(() => { let active = true; const refresh=()=>{ if (globalThis.document?.visibilityState === "hidden") return; void readPublicPromotionWeights().then(value=>{if(active)setWeights(value);}); }; refresh(); const timer=setInterval(refresh,60_000); globalThis.addEventListener("focus",refresh); return () => { active = false; clearInterval(timer); globalThis.removeEventListener("focus",refresh); }; }, []);
  return weights;
}

export function usePublicPromotionWeights(world: World) {
  const weights = usePromotionSnapshot();
  return useMemo(() => {
    const map = new Map<number, number>();
    weights.filter((entry) => entry.world === world).forEach((entry) => map.set(entry.supplierId, entry.weight));
    return (supplierId: number|string) => map.get(promotionSupplierId(supplierId))||0;
  }, [weights, world]);
}

export function usePublicPromotionFlags(world: World) {
  const weights = usePromotionSnapshot();
  return useMemo(() => {
    const map = new Map<number, Weight>();
    weights.filter(entry => entry.world === world).forEach(entry => map.set(entry.supplierId, entry));
    return (supplierId: number | string) => map.get(promotionSupplierId(supplierId)) || null;
  }, [weights, world]);
}
