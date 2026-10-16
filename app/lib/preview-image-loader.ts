/** Intent-only warming. No requests are made by constructing the loader. */
export function createPreviewImageLoader(createImage: () => HTMLImageElement = () => new Image()) {
  const ready = new Map<string, true>();
  const pending = new Map<string, { src: string; promise: Promise<boolean>; resolve: (ready: boolean) => void }>();
  const queue: Array<{ src: string; promise: Promise<boolean>; resolve: (ready: boolean) => void }> = [];
  let active = 0;

  function pump() {
    while (active < 2 && queue.length) {
      const job = queue.shift()!;
      active++;
      const image = createImage();
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (!ok) image.removeAttribute("src");
        active--;
        pending.delete(job.src);
        if (ok) {
          ready.set(job.src, true);
          if (ready.size > 48) ready.delete(ready.keys().next().value!);
        }
        job.resolve(ok);
        pump();
      };
      const timer = setTimeout(() => finish(false), 12_000);
      image.onload = () => {
        if (!image.naturalWidth) { finish(false); return; }
        if (typeof image.decode === "function") image.decode().then(() => finish(true), () => finish(false));
        else finish(true);
      };
      image.onerror = () => finish(false);
      image.decoding = "async";
      image.src = job.src;
    }
  }

  function load(src: string, urgent = true): Promise<boolean> {
    if (!src) return Promise.resolve(false);
    if (ready.has(src)) {
      ready.delete(src);
      ready.set(src, true);
      return Promise.resolve(true);
    }
    const existing = pending.get(src);
    if (existing) {
      const position = queue.indexOf(existing);
      if (urgent && position > 0) queue.unshift(...queue.splice(position, 1));
      return existing.promise;
    }
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    const job = { src, promise, resolve };
    pending.set(src, job);
    if (urgent) queue.unshift(job); else queue.push(job);
    // Keep the most recent intent. Resolve discarded work so callers never hang.
    while (queue.length > 8) {
      const discarded = queue.pop()!;
      pending.delete(discarded.src);
      discarded.resolve(false);
    }
    pump();
    return promise;
  }

  return { load };
}

export const previewImageLoader = createPreviewImageLoader();
