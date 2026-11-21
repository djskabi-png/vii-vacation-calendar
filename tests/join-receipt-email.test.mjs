import test from "node:test";
import assert from "node:assert/strict";
import { deliverJoinReceipt } from "../app/lib/join-receipt-email.ts";

const input = {
  submissionId: "join-123",
  email: "Owner@Example.com",
  name: "דנה ישראלי",
  organization: "העסק של דנה",
  world: "vacation",
  reference: "VII-123",
};

test("join receipt is sent once with a stable idempotency key and a non-sensitive Hebrew receipt", async () => {
  let request;
  const result = await deliverJoinReceipt(input, {
    VII_JOIN_EMAIL_PROVIDER: "resend",
    VII_JOIN_EMAIL_API_KEY: "fixture-secret",
    VII_JOIN_EMAIL_FROM: "VII <hello@example.test>",
  }, async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return Response.json({ id: "provider-message-1" });
  });

  assert.deepEqual(result, { status: "sent", providerMessageId: "provider-message-1" });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers["Idempotency-Key"], "vii-join-receipt:join-123");
  assert.deepEqual(request.body.to, ["owner@example.com"]);
  assert.match(request.body.subject, /בקשת ההצטרפות/);
  assert.match(request.body.text, /מספר פנייה: VII-123/);
  assert.doesNotMatch(request.body.text, /fixture-secret/);
});

test("join receipt reuses the configured production quality sender without exposing recipients", async () => {
  let body;
  const result = await deliverJoinReceipt(input, {
    VII_QUALITY_EMAIL_PROVIDER: "resend",
    VII_QUALITY_EMAIL_API_KEY: "fixture-secret",
    VII_QUALITY_EMAIL_FROM: "VII <qa@example.test>",
  }, async (_url, options) => {
    body = JSON.parse(options.body);
    return Response.json({ id: "provider-message-2" });
  });
  assert.equal(result.status, "sent");
  assert.deepEqual(body.to, ["owner@example.com"]);
});

test("join receipt never claims delivery without a provider confirmation", async () => {
  assert.deepEqual(await deliverJoinReceipt(input, {}), {
    status: "disabled",
    providerMessageId: null,
    reason: "email_provider_not_configured",
  });
  assert.deepEqual(await deliverJoinReceipt(input, {
    VII_JOIN_EMAIL_PROVIDER: "resend",
    VII_JOIN_EMAIL_API_KEY: "fixture-secret",
    VII_JOIN_EMAIL_FROM: "VII <hello@example.test>",
  }, async () => new Response("no", { status: 503 })), {
    status: "failed",
    providerMessageId: null,
    reason: "provider_http_503",
  });
});
