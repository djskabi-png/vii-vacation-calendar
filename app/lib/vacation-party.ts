export type VacationSearchRoom = { adults: number; children?: number; infants?: number };

function safeCount(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function vacationRoomsFromSearchParams(params: { get(name: string): string | null }): VacationSearchRoom[] {
  const adults = safeCount(params.get("adults"), safeCount(params.get("guests"), 2, 1, 30), 1, 30);
  const children = safeCount(params.get("children"), 0, 0, 20);
  const infants = safeCount(params.get("infants"), 0, 0, 10);
  const requestedRooms = safeCount(params.get("rooms"), 1, 1, 12);
  const roomCount = Math.min(requestedRooms, adults);
  const rooms = Array.from({ length: roomCount }, () => ({ adults: 0, children: 0, infants: 0 }));
  for (let index = 0; index < adults; index += 1) rooms[index % roomCount].adults += 1;
  for (let index = 0; index < children; index += 1) rooms[index % roomCount].children += 1;
  for (let index = 0; index < infants; index += 1) rooms[index % roomCount].infants += 1;
  return rooms.map((room) => ({ adults: room.adults, ...(room.children ? { children: room.children } : {}), ...(room.infants ? { infants: room.infants } : {}) }));
}

export function vacationRoomGuests(rooms: VacationSearchRoom[]) {
  return rooms.reduce((total, room) => total + room.adults + (room.children || 0), 0);
}

export function validVacationRooms(value: unknown, guests: number): value is VacationSearchRoom[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 10 && value.every(room => room && typeof room === "object"
    && Number.isSafeInteger(room.adults) && room.adults >= 1 && room.adults <= 30
    && (room.children === undefined || Number.isSafeInteger(room.children) && room.children >= 0 && room.children <= 20)
    && (room.infants === undefined || Number.isSafeInteger(room.infants) && room.infants >= 0 && room.infants <= 10))
    && vacationRoomGuests(value) === guests;
}

export function supplierPartyRooms(rooms: VacationSearchRoom[]) {
  return rooms.map(({ adults, children, infants }) => ({ adults, ...(children ? { kids: children } : {}), ...(infants ? { infants } : {}) }));
}

export function vacationPartyForGuestCount(guests: number, children = 0, infants = 0, rooms = 1) {
  if (![guests, children, infants, rooms].every(Number.isSafeInteger) || children < 0 || infants < 0 || rooms < 1 || guests <= children || rooms > guests - children) return [];
  return vacationRoomsFromSearchParams(new URLSearchParams({ adults: String(guests - children), children: String(children), infants: String(infants), rooms: String(rooms) }));
}
