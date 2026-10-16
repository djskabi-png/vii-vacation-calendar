export type OnlineBookingEvidence = {
  ready: boolean;
  onlineBooking?: boolean;
  bookingSupported: boolean;
  availability?: string;
  price?: number;
  from?: string;
  till?: string;
  selectedFrom?: string;
  selectedTill?: string;
  illustrative?: boolean;
};

// A catalog price, a contact form or an old selection cannot certify booking.
export function canShowOnlineBookingBadge(value: OnlineBookingEvidence): boolean {
  const validDate = (date: string | undefined) => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date);
  return value.ready === true && value.onlineBooking === true && value.bookingSupported === true
    && value.illustrative !== true && value.availability === "available"
    && typeof value.price === "number" && Number.isFinite(value.price) && value.price > 0
    && validDate(value.from) && validDate(value.till) && value.from! < value.till!
    && value.from === value.selectedFrom && value.till === value.selectedTill;
}
