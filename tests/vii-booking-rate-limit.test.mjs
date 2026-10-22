import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingError } from "../app/lib/vii-supplier-booking.ts";
import { limitBookingRequests } from "../app/lib/booking-rate-limit.ts";

function database(changes = 1) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push({ sql, values: [] });
      return {
        bind(...values) {
          calls.at(-1).values = values;
          return this;
        },
        async run() {
          return { success: true, meta: { changes } };
        },
      };
    },
  };
}

test("booking rate limiter uses the migrated table without request-time DDL", async () => {
  const db = database();
  await limitBookingRequests(new Request("https://vii.test/api/vii/booking", {
    headers: { "cf-connecting-ip": "203.0.113.17" },
  }), { db, token: "supplier-token" });

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /^INSERT INTO vii_booking_rate/);
  assert.doesNotMatch(db.calls[0].sql, /CREATE TABLE/i);
  assert.equal(db.calls[0].values.length, 2);
  assert.equal(db.calls[0].values[1], Math.floor(Date.now() / 3_600_000));
  assert.match(db.calls[0].values[0], /^\d+:[a-f0-9]{64}$/);
});

test("booking rate limiter fails closed when the bucket is not changed", async () => {
  const db = database(0);
  await assert.rejects(
    limitBookingRequests(new Request("https://vii.test/api/vii/booking", {
      headers: { "cf-connecting-ip": "203.0.113.17" },
    }), { db, token: "supplier-token" }),
    (error) => error instanceof BookingError && error.code === "rate_limited" && error.httpStatus === 429,
  );
});

test("booking rate limiter requires the edge client address", async () => {
  const db = database();
  await assert.rejects(
    limitBookingRequests(new Request("https://vii.test/api/vii/booking"), { db, token: "supplier-token" }),
    (error) => error instanceof BookingError && error.code === "supplier_unavailable" && error.httpStatus === 503,
  );
  assert.equal(db.calls.length, 0);
});
