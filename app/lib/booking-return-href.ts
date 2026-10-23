export type BookingWorld = "vacation" | "events" | "hourly" | "spa" | "providers" | "activities";

type BookingReturnInput = {
  world: string;
  placeId: string;
  from?: string;
  till?: string;
  guests?: string;
  rooms?: string;
  children?: string;
  infants?: string;
  price?: number;
  illustrative?: boolean;
};

export function bookingReturnHref(input: BookingReturnInput) {
  const id = encodeURIComponent(input.placeId);
  if (input.world === "events") return `/events/place/${id}`;
  if (["hourly", "spa", "providers", "activities"].includes(input.world)) return `/discover/place/${id}`;

  const params = new URLSearchParams({ id: input.placeId });
  if (input.from) params.set("from", input.from);
  if (input.till) params.set("till", input.till);
  if (input.guests) params.set("guests", input.guests);
  if (input.rooms) params.set("rooms", input.rooms);
  if (input.children) params.set("children", input.children);
  if (input.infants) params.set("infants", input.infants);
  if (input.price) params.set("price", String(input.price));
  if (input.illustrative) params.set("illustrative", "1");
  return `/business?${params.toString()}`;
}
