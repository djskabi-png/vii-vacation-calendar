"use client";

import { useEffect, useState } from "react";
import type { PublicGeographyNode } from "../lib/geography-search";

let acceptedNodes: PublicGeographyNode[] | null = null;
let activeRequest: Promise<PublicGeographyNode[]> | null = null;

function loadManagedGeography() {
  if (acceptedNodes) return Promise.resolve(acceptedNodes);
  if (!activeRequest) {
    activeRequest = fetch("/api/vii/geography")
      .then(async (response) => response.ok ? response.json() as Promise<{ nodes?: PublicGeographyNode[] }> : { nodes: [] })
      .then((payload) => {
        acceptedNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        return acceptedNodes;
      })
      .catch(() => [])
      .finally(() => { activeRequest = null; });
  }
  return activeRequest;
}

export function useManagedGeography(enabled = true) {
  const [nodes, setNodes] = useState<PublicGeographyNode[]>(() => acceptedNodes || []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadManagedGeography().then((result) => { if (active) setNodes(result); });
    return () => { active = false; };
  }, [enabled]);
  return nodes;
}
