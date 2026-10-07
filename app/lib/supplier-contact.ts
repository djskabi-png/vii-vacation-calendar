export function supplierContactNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const number = value.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  return /^[+\d()\s-]{7,24}$/.test(number) ? number : undefined;
}
