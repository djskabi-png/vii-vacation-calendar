export type MapLayoutInvalidator = {
  invalidateSize: (options: { animate: boolean; pan: boolean }) => void;
};

export function createMapLayoutSynchronizer(
  map: MapLayoutInvalidator,
  container: HTMLElement,
  view: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame" | "setTimeout" | "clearTimeout"> = window,
) {
  let frames: number[] = [];
  let timer: number | undefined;
  let disposed = false;
  const sync = () => {
    if (disposed || !container.isConnected) return;
    map.invalidateSize({ animate: false, pan: false });
  };
  const schedule = () => {
    if (disposed) return;
    frames.forEach((frame) => view.cancelAnimationFrame(frame));
    if (timer) view.clearTimeout(timer);
    frames = [
      view.requestAnimationFrame(sync),
      view.requestAnimationFrame(() => frames.push(view.requestAnimationFrame(sync))),
    ];
    timer = view.setTimeout(sync, 160);
  };
  const dispose = () => {
    disposed = true;
    frames.forEach((frame) => view.cancelAnimationFrame(frame));
    frames = [];
    if (timer) view.clearTimeout(timer);
    timer = undefined;
  };
  return { sync, schedule, dispose };
}
