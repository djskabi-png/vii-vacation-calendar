import source from "./sergey-place-details.json";

export type SupplierPlaceDetail = {
  images: string[];
  summary: string;
  policy: { checkIn: string; checkOut: string; checkOutSat: string; remarks: string };
  rooms: Array<{ name: string; quantity: number; guests: number; bedrooms: number; features: string[] }>;
  reviews: Array<{ id: number; author: string; title: string; text: string; date: string; score?: number }>;
  sourceUrl: string;
};

export function supplierPlaceDetail(slug: string): SupplierPlaceDetail | undefined {
  return (source.details as Record<string, SupplierPlaceDetail>)[slug];
}
