export async function supplierStayUnitQuotes<T extends { status: string }>(options: {
  roomIDs: number[];
  concurrency?: number;
  quote(roomID: number): Promise<T>;
}) {
  const results = new Array<{ roomID: number } & (T | { status: "unverified"; reason: "supplier_unavailable" })>(options.roomIDs.length);
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, options.roomIDs.length));
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < options.roomIDs.length) {
      const index = cursor++;
      const roomID = options.roomIDs[index];
      try {
        results[index] = { roomID, ...(await options.quote(roomID)) };
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_stay") throw error;
        results[index] = { roomID, status: "unverified", reason: "supplier_unavailable" };
      }
    }
  }));
  return results;
}
