export function supplierContactNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const number = value.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  return /^[+\d()\s-]{7,24}$/.test(number) ? number : undefined;
}

export function supplierPhoneLink(value: unknown): { display: string; href: string } | undefined {
  const display = supplierContactNumber(value);
  if (!display) return undefined;
  const digits = display.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? { display, href: `tel:${digits}` } : undefined;
}
