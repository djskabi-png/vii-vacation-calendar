import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingError, createSupplierBooking } from "../app/lib/vii-supplier-booking.ts";

const base = {
  siteID: 389, roomID: 1433, from: "2026-10-12", till: "2026-10-13", guests: 2,
  expectedTotal: 100, partnerRef: "VII-test-389-1433-20261012",
  guest: { firstName: "Dana", lastName: "Levi", phone: "0501111111", email: "dana@example.com" },
  token: "test", publishedIds: new Set([389]),
};
const stay = { siteID: 389, from: base.from, till: base.till, nights: 1, currency:'ILS',
  rooms: [{ roomID: 1433, pax: { adults: 2 } }], totals: { total: 100 } };
const vacancy = { available: true, onlineBooking: true, summary: stay };
const search = { sites: [{ siteID: 389, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 1433 }] } }] };
const booking = { partnerRef: base.partnerRef, status: "confirmed", bookingID: 7, systemOrderID: 8,
  guest: base.guest, summary: stay };

function fakeFetch(get = new Response(null, { status: 404 }), check = Response.json(vacancy), create = Response.json(booking, { status: 201 })) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (init.method === "GET") return get;
    return url.endsWith("/search") ? Response.json(search) : url.endsWith("/vacancy") ? check : create;
  } };
}

test("creates a supplier booking with no payment and returns the supplier status", async () => {
  const { calls, fetchImpl } = fakeFetch();
  assert.deepEqual(await createSupplierBooking({ ...base, fetchImpl }), {
    success: true, reference: base.partnerRef, status: "confirmed", bookingID: 7, systemOrderID: 8, approvalRequired: false, replay: false,
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[3].body, {
    siteID: 389, from: base.from, nights: 1, rooms: [{ roomID: 1433, adults: 2 }],
    partnerRef: base.partnerRef, guest: base.guest,
  });
});

test("an existing reference is read, not sent again", async () => {
  const { calls, fetchImpl } = fakeFetch(Response.json({ ...booking, status: "pending_approval" }));
  const result = await createSupplierBooking({ ...base, fetchImpl });
  assert.equal(result.status, "pending_approval");
  assert.equal(result.replay, true);
  assert.equal(calls.length, 1);
});

test("price changes and disabled online bookings never reach create", async () => {
  for (const modified of [{ ...vacancy, summary: { ...stay, totals: { total: 120 } } }, { ...vacancy, onlineBooking: false }]) {
    const { calls, fetchImpl } = fakeFetch(undefined, Response.json(modified));
    await assert.rejects(createSupplierBooking({ ...base, fetchImpl }), (error) => error instanceof BookingError && error.httpStatus === 409);
    assert.equal(calls.length, 3);
  }
});

test("preserves safe booking status fields and distinct supplier failures", async () => {
  const accepted = { ...booking, status: "pending_approval", orderType: "preorder", approvalRequired: true, created: "2026-10-22T12:00:00+03:00" };
  const result = await createSupplierBooking({ ...base, fetchImpl: fakeFetch(Response.json(accepted)).fetchImpl });
  assert.equal(result.orderType, "preorder");
  assert.equal(result.approvalRequired, true);
  assert.equal(result.created, accepted.created);

  const failed = fakeFetch(undefined, undefined, Response.json({ error_code: "online_booking_disabled" }, { status: 409 }));
  await assert.rejects(createSupplierBooking({ ...base, fetchImpl: failed.fetchImpl }), (error) => error instanceof BookingError && error.code === "online_booking_disabled");
});

test("unknown create result is not automatically retried", async () => {
  const { calls, fetchImpl } = fakeFetch();
  const uncertain = async (url, init) => init.method === "POST" && url.endsWith("/booking") ? Promise.reject(new Error("timeout")) : fetchImpl(url, init);
  await assert.rejects(createSupplierBooking({ ...base, fetchImpl: uncertain }), (error) => error instanceof BookingError && error.code === "booking_status_unknown");
  assert.equal(calls.length, 3);
});

test("unpublished sites cannot write to the supplier", async () => {
  await assert.rejects(createSupplierBooking({ ...base, siteID: 123, fetchImpl: async () => { throw Error("called"); } }), /invalid_booking/);
});

test('family composition is identical in search, vacancy, booking and idempotent receipt',async()=>{
 const party={adults:2,children:1,infants:1},familyStay={...stay,rooms:[{roomID:1433,pax:{adults:2,kids:1,infants:1}}]};
 const familyBooking={...booking,summary:familyStay};
 const f=fakeFetch(undefined,Response.json({...vacancy,summary:familyStay}),Response.json(familyBooking,{status:201}));
 const result=await createSupplierBooking({...base,guests:3,party,fetchImpl:f.fetchImpl});
 assert.equal(result.success,true);
 assert.deepEqual(f.calls[1].body.rooms,[{adults:2,kids:1,infants:1}]);
 assert.deepEqual(f.calls[2].body.rooms,[{roomID:1433,adults:2,kids:1,infants:1}]);
 assert.deepEqual(f.calls[3].body.rooms,f.calls[2].body.rooms);
 const replay=fakeFetch(Response.json(familyBooking));
 assert.equal((await createSupplierBooking({...base,guests:3,party,fetchImpl:replay.fetchImpl})).replay,true);assert.equal(replay.calls.length,1);
});
test('guest composition or currency disagreement blocks a booking write',async()=>{
 for(const summary of [{...stay,currency:'USD'},{...stay,rooms:[{roomID:1433,pax:{adults:1,kids:1}}]}]){
  const f=fakeFetch(undefined,Response.json({...vacancy,summary}));
  await assert.rejects(createSupplierBooking({...base,fetchImpl:f.fetchImpl}),/invalid_supplier_response/);assert.equal(f.calls.length,3);
 }
 const invalid=fakeFetch();await assert.rejects(createSupplierBooking({...base,party:{adults:1},fetchImpl:invalid.fetchImpl}),/invalid_booking/);assert.equal(invalid.calls.length,0);
});
