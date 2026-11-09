import type { R2Bucket } from "../../types/cloudflare-runtime";

type R2PutOptions = NonNullable<Parameters<R2Bucket["put"]>[2]>;
type R2Revision = { uploaded?: Date | string | number };
type Clock = () => number;
type Wait = (milliseconds: number) => Promise<void>;

const MIN_INTERVAL_MS = 1_100;

/** Pace a mutable JSON CAS write for R2's same-key write limit.
 *
 * The prior revision is only a pacing hint. Its conditional options are passed
 * through untouched, and a rejected or uncertain put is never retried here.
 * Synthetic fixtures may omit `uploaded`; that keeps compatibility but does not
 * claim to model R2's rate enforcement.
 */
export async function putPacedR2Json(
  bucket: R2Bucket,
  key: string,
  text: string,
  putOptions: R2PutOptions,
  previousRevision?: R2Revision | null,
  dependencies: { now?: Clock; wait?: Wait } = {},
) {
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const uploaded = previousRevision?.uploaded;

  if (uploaded !== undefined) {
    const timestamp = uploaded instanceof Date ? uploaded.getTime() : typeof uploaded === "number" ? uploaded : Date.parse(uploaded);
    if (!Number.isFinite(timestamp)) throw new TypeError("r2_revision_timestamp_invalid");
    const delay = timestamp + MIN_INTERVAL_MS - now();
    if (delay > 0) {
      if (delay > 5_000) throw new RangeError("r2_revision_time_future");
      await wait(delay);
    }
  }

  return bucket.put(key, text, putOptions);
}

export { MIN_INTERVAL_MS };
