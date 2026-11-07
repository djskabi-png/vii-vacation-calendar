// Local release QA server for the exact built Worker and client assets.
// It performs no business writes. Read-only API/media calls are proxied to the current
// public application only when the local Worker does not have cloud bindings.
import http from "node:http";
import fs from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import worker from "../dist/server/index.js";
import { catalogResponse } from "../app/api/catalog/route.ts";

const port = Number(process.argv.find((value) => value.startsWith("--port="))?.slice(7) || 4191);
const publicOrigin = "https://vii.spaplus.co";
// Inspect changed catalog projections locally instead of silently hydrating
// a new candidate with the old production catalog. Still read-only, no D1.
const localCatalog = process.argv.includes("--local-catalog");
// QA-only fault injection: prove the first viewport is styled before the full
// public stylesheet arrives. Never part of the deployed Worker.
const publicStyleDelay = Math.min(10_000, Math.max(0, Number(process.argv.find(value => value.startsWith('--delay-public-styles='))?.split('=')[1]) || 0));
const clientRoot = resolve("dist/client");
// Explicit compatibility rehearsal: bootstrap the exact qualified predecessor
// document, but resolve subsequent Flight navigation with the candidate Worker.
const predecessorArgument = process.argv.find(value => value.startsWith('--predecessor-dist='))?.slice('--predecessor-dist='.length);
const predecessorRoot = predecessorArgument ? resolve(predecessorArgument) : null;
const predecessor = predecessorRoot ? (await import(pathToFileURL(resolve(predecessorRoot, 'server/index.js')).href)).default : null;
const mime = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
const assets = {
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const path = resolve(clientRoot, `.${pathname}`);
    if (!path.startsWith(clientRoot + sep)) return new Response("Not found", { status: 404 });
    const delayedStyle = publicStyleDelay && /^\/assets\/vii-public-[a-z]+-[a-f0-9]+\.css$/.test(pathname);
    if (delayedStyle) await new Promise(resolveDelay => setTimeout(resolveDelay, publicStyleDelay));
    try { return new Response(await fs.readFile(path), { headers: { "Content-Type": mime[extname(path)] || "application/octet-stream", ...(delayedStyle ? { "Cache-Control": "no-store" } : {}) } }); }
    catch {
      if (predecessorRoot) {
        const previousRoot = resolve(predecessorRoot, 'client');
        const previous = resolve(previousRoot, `.${pathname}`);
        if (previous.startsWith(previousRoot + sep)) {
          try { return new Response(await fs.readFile(previous), { headers: { "Content-Type": mime[extname(previous)] || "application/octet-stream" } }); } catch { /* current and predecessor both lack the asset */ }
        }
      }
      return new Response("Not found", { status: 404 });
    }
  },
};
const context = { waitUntil(promise) { promise.catch(() => undefined); }, passThroughOnException() {} };
// These POST handlers only calculate supplier quotes. Reservation, lead,
// account and administration mutations remain unavailable in this preview.
const quoteReadPaths = new Set(["/api/vii/stay-quote", "/api/vii/stay-unit-quotes"]);

const server = http.createServer(async (request, response) => {
  try {
    const incoming = new URL(request.url || "/", publicOrigin);
    if (publicStyleDelay && incoming.pathname === '/__qa/critical-style-entry') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><html><body><a href="/vacations/kinneret">Kinneret delayed stylesheet</a><a href="/">Home delayed stylesheet</a><a href="/events">Events delayed stylesheet</a><a href="/spas">Spa delayed stylesheet</a><a href="/hourly">Hourly delayed stylesheet</a></body></html>');
      return;
    }
    const quoteRead = request.method === "POST" && quoteReadPaths.has(incoming.pathname);
    if (request.method !== "GET" && request.method !== "HEAD" && !quoteRead) { response.writeHead(405); response.end(); return; }
    let quoteBody;
    if (quoteRead) {
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 65_536) { response.writeHead(413); response.end(); return; } chunks.push(chunk); }
      quoteBody = Buffer.concat(chunks);
    }
    let result = await assets.fetch(new Request(incoming));
    if (result.status === 404 && localCatalog && incoming.pathname === "/api/catalog") {
      result = await catalogResponse(new Request(incoming), null);
    } else if (result.status === 404 && incoming.pathname !== "/api/vii/homepage-presentation" && (incoming.pathname.startsWith("/api/") || incoming.pathname === "/_vinext/image")) {
      result = await fetch(`${publicOrigin}${incoming.pathname}${incoming.search}`, { method: quoteRead ? "POST" : request.method, headers: { Accept: request.headers.accept || "*/*", ...(quoteRead ? { "Content-Type": "application/json" } : {}) }, ...(quoteRead ? { body: quoteBody } : {}), signal: AbortSignal.timeout(45_000) });
    } else if (result.status === 404) {
      const flight = incoming.pathname.endsWith('.rsc') || request.headers.rsc === '1' || String(request.headers.accept || '').includes('text/x-component');
      const renderer = predecessor && !flight && String(request.headers.accept || '').includes('text/html') ? predecessor : worker;
      result = await renderer.fetch(new Request(incoming, { headers: request.headers }), { ASSETS: assets }, context);
    }
    const headers = Object.fromEntries(result.headers);
    // Keep canonical redirects within the candidate preview. Otherwise a
    // relative route resolved by the Worker against its public origin silently
    // escapes to the predecessor and invalidates browser release evidence.
    if (headers.location) {
      const destination = new URL(headers.location, publicOrigin);
      if (destination.origin === publicOrigin) headers.location = `${destination.pathname}${destination.search}${destination.hash}`;
    }
    for (const name of ["content-encoding", "content-length", "transfer-encoding"]) delete headers[name];
    const body = result.body ? Buffer.from(await result.arrayBuffer()) : null;
    response.writeHead(result.status, { ...headers, "X-VII-Local-QA": "built candidate; read-only public API fallback" });
    response.end(body);
  } catch (error) {
    response.writeHead(503, { "Content-Type": "text/plain" });
    response.end(error instanceof Error ? error.message : "candidate_preview_unavailable");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`OWNED_PID=${process.pid} http://127.0.0.1:${port}`));
process.on("SIGINT", () => server.close(() => process.exit(0)));
