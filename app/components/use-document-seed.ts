"use client";
import { useEffect, useState } from "react";
import {usePathname,useSearchParams} from 'next/navigation';
import {discoveryExposureScope} from '../lib/discovery-exposure-scope';
let sharedDocumentSeed = "";

/** One seed per browser document. Server and first hydration render use 0;
 * after hydration a fresh seed is chosen and remains stable for the document. */
export function useDocumentSeed(scoped = true): string {
  const pathname=usePathname(),params=useSearchParams();
  const [seed, setSeed] = useState("0");
  useEffect(() => {
    if (!sharedDocumentSeed) sharedDocumentSeed = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setSeed(sharedDocumentSeed);
  }, []);
  return scoped?`${seed}:${discoveryExposureScope(pathname,params)}`:seed;
}
