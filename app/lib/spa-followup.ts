export function scheduleSpaDealFollowup(status: "verified" | "refreshing" | undefined, count: number, onFollowup: () => void,
  schedule: (callback: () => void, delay: number) => unknown = (callback, delay) => setTimeout(callback, delay)) {
  if (status !== "refreshing" || count >= 2) return null;
  return { nextCount: count + 1, timer: schedule(onFollowup, count === 0 ? 2_000 : 4_000) };
}
