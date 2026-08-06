export const ACCOUNT_KEY = "vii-local-account";
export const BOOKINGS_KEY = "vii-bookings-v1";
export const ACCOUNT_EVENT = "vii-account-change";

export type LocalAccount = { name: string; email: string; phone?: string; createdAt: string };
export type BookingRecord = {
  id: string;
  reference?: string;
  world: string;
  placeName: string;
  offerName: string;
  date?: string;
  guests?: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

export function readAccount(): LocalAccount | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null") as LocalAccount | null; } catch { return null; }
}

export function saveAccount(account: LocalAccount | null) {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else localStorage.removeItem(ACCOUNT_KEY);
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

export function readBookings(): BookingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "[]") as BookingRecord[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function saveBooking(record: BookingRecord) {
  const current = readBookings();
  const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 50);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}
