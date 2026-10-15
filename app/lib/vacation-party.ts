export type VacationSearchRoom = { adults: number; children?: number };

function safeCount(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function vacationRoomsFromSearchParams(params: { get(name: string): string | null }): VacationSearchRoom[] {
  const adults = safeCount(params.get("adults"), safeCount(params.get("guests"), 2, 1, 30), 1, 30);
  const children = safeCount(params.get("children"), 0, 0, 20);
  const requestedRooms = safeCount(params.get("rooms"), 1, 1, 12);
  const roomCount = Math.min(requestedRooms, adults);
  const rooms = Array.from({ length: roomCount }, () => ({ adults: 0, children: 0 }));
  for (let index = 0; index < adults; index += 1) rooms[index % roomCount].adults += 1;
  for (let index = 0; index < children; index += 1) rooms[index % roomCount].children += 1;
  return rooms.map((room) => ({ adults: room.adults, ...(room.children ? { children: room.children } : {}) }));
}

export function vacationRoomGuests(rooms: VacationSearchRoom[]) {
  return rooms.reduce((total, room) => total + room.adults + (room.children || 0), 0);
}
