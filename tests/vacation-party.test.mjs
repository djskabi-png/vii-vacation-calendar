import assert from "node:assert/strict";
import { test } from "node:test";
import { vacationRoomGuests, vacationRoomsFromSearchParams } from "../app/lib/vacation-party.ts";

function params(values) {
  return new URLSearchParams(values);
}

test("vacation party defaults to one room and two adults", () => {
  assert.deepEqual(vacationRoomsFromSearchParams(params()), [{ adults: 2 }]);
});

test("vacation party preserves a multi-room search without losing children", () => {
  const rooms = vacationRoomsFromSearchParams(params({ adults: "5", children: "2", rooms: "3" }));
  assert.deepEqual(rooms, [{ adults: 2, children: 1 }, { adults: 2, children: 1 }, { adults: 1 }]);
  assert.equal(vacationRoomGuests(rooms), 7);
});

test("vacation party never creates empty rooms", () => {
  assert.deepEqual(vacationRoomsFromSearchParams(params({ adults: "2", children: "4", rooms: "5" })), [{ adults: 1, children: 2 }, { adults: 1, children: 2 }]);
});
