export type PacedRailRenderOptions = {
  initial: number;
  total: number;
  onCount: (count: number) => void;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  requestIdle?: (callback: () => void) => number;
  cancelIdle?: (id: number) => void;
};

/** Each batch is separated by a paint opportunity. All handles belong to this
 * schedule and cleanup also guards callbacks already delivered by the browser. */
export function schedulePacedRailRender(options: PacedRailRenderOptions) {
  const total = Number.isFinite(options.total) ? Math.max(0, Math.floor(options.total)) : 0;
  let count = Math.min(total, Math.max(0, Math.floor(options.initial) || 0));
  let cancelled = false;
  let frame: number | undefined;
  let idle: number | undefined;
  const nextFrame = (callback: () => void) => {
    frame = options.requestFrame(() => { frame = undefined; if (!cancelled) callback(); });
  };
  const append = () => {
    if (cancelled || count >= total) return;
    count = Math.min(total, count + 2);
    options.onCount(count);
    if (!cancelled && count < total) nextFrame(scheduleBatch);
  };
  const scheduleBatch = () => {
    if (cancelled || count >= total) return;
    if (options.requestIdle && options.cancelIdle) {
      idle = options.requestIdle(() => { idle = undefined; if (!cancelled) append(); });
    } else nextFrame(append);
  };
  if (count < total) nextFrame(() => nextFrame(scheduleBatch));
  return () => {
    cancelled = true;
    if (frame !== undefined) options.cancelFrame(frame);
    if (idle !== undefined) options.cancelIdle?.(idle);
    frame = undefined;
    idle = undefined;
  };
}
