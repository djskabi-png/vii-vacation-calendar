import assert from "node:assert/strict";
import test from "node:test";
import { RequestBodyError, readJsonBody } from "../src/request-body.ts";

const req = (stream, signal) => ({ body: stream, signal: signal || new AbortController().signal });
const jsonStream = (text, delay = 0) => new ReadableStream({ start(controller) { setTimeout(() => { controller.enqueue(new TextEncoder().encode(text)); controller.close(); }, delay); } });

test("reads valid JSON", async () => assert.deepEqual(await readJsonBody(req(jsonStream('{"ok":true}'))), { ok: true }));
test("rejects malformed JSON with stable 400", async () => await assert.rejects(readJsonBody(req(jsonStream("not-json"))), e => e instanceof RequestBodyError && e.status === 400 && e.message === "invalid_json"));
test("rejects multibyte payload over byte budget", async () => await assert.rejects(readJsonBody(req(jsonStream(JSON.stringify({ value: "😀" })), undefined), { maxBytes: 12 }), e => e.status === 413));
test("uses one total deadline across slow chunks", async () => {
  const stream = new ReadableStream({ async start(controller) { controller.enqueue(new TextEncoder().encode('{"a":')); await new Promise(resolve => setTimeout(resolve, 80)); controller.enqueue(new TextEncoder().encode("1}")); controller.close(); } });
  await assert.rejects(readJsonBody(req(stream), { deadlineMs: 30 }), e => e.status === 408 && e.message === "request_body_timeout");
});
test("cancels on request abort and cleans up", async () => {
  const controller = new AbortController(); let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const pending = readJsonBody(req(stream, controller.signal)); controller.abort();
  await assert.rejects(pending, e => e.status === 408 && e.message === "request_cancelled");
  await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(cancelled, true);
});

test("an uncooperative cancellation callback cannot hold the body deadline open",async()=>{
  let cancelled=false;
  const stream=new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{});}});
  await assert.rejects(readJsonBody(req(stream),{deadlineMs:10}),error=>error.status===408);
  assert.equal(cancelled,true);
});
