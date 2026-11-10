export type MapTileLayer = "street" | "aerial";

export function createMapTileHealth(
  onReady: () => void,
  onFailure: (error: Error) => void,
  timeoutMs = 12000,
  timers: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis,
) {
  const loaded = new Set<MapTileLayer>();
  const failed = new Set<MapTileLayer>();
  let settled = false;
  let disposed = false;
  const timeout = timers.setTimeout(() => {
    if (settled || disposed) return;
    settled = true;
    onFailure(new Error("Map tiles did not become available before the bounded readiness deadline."));
  }, timeoutMs);
  const markLoaded = (layer: MapTileLayer) => {
    if (settled || disposed || failed.has(layer)) return;
    loaded.add(layer);
  };
  const complete = (layer: MapTileLayer) => {
    if (settled || disposed || failed.has(layer)) return;
    if (loaded.has(layer)) {
      settled = true;
      timers.clearTimeout(timeout);
      onReady();
      return;
    }
    failed.add(layer);
    if (failed.size === 2) {
      settled = true;
      timers.clearTimeout(timeout);
      onFailure(new Error("Both approved map tile layers failed to load."));
    }
  };
  const markFailed = (layer: MapTileLayer) => {
    if (settled || disposed) return;
    failed.add(layer);
    if (failed.size === 2) {
      settled = true;
      timers.clearTimeout(timeout);
      onFailure(new Error("Both approved map tile layers failed to load."));
    }
  };
  const dispose = () => { disposed = true; timers.clearTimeout(timeout); };
  return { markLoaded, markFailed, complete, dispose };
}
