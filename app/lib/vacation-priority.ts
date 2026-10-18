import { dailyRotationCompare } from "./daily-rotation.ts";

// Content Studio's existing promotion order: 1 is strongest, 999 is weakest.
// Missing or invalid values come after every explicitly managed priority.
export function managedVacationPriority(value: unknown): number | undefined {
  const rank = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isSafeInteger(rank) && rank > 0 && rank <= 999 ? rank : undefined;
}

export function compareVacationPriority(first: { curatedRank?: number }, second: { curatedRank?: number }, firstId: string | number, secondId: string | number, context: string, day?: string): number {
  return (managedVacationPriority(first.curatedRank) ?? 1000) - (managedVacationPriority(second.curatedRank) ?? 1000)
    || dailyRotationCompare(firstId, secondId, context, day);
}
