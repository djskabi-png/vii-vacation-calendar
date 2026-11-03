// Local release QA server for the exact built Worker and client assets.
// It performs no writes. Read-only API/media calls are proxied to the current
// public application only when the local Worker does not have cloud bindings.
import http from "node:http";
import fs from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import worker from "../dist/server/index.js";

const port = Number(process.argv.find((value) => value.startsWith("--port="))?.slice(7) || 4191);
const publicOrigin = "https://vii.spaplus.co";
const clientRoot = resolve("dist/client");
const mime = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
const assets = {
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const path = resolve(clientRoot, `.${pathname}`);
    if (!path.startsWith(clientRoot + sep)) return new Response("Not found", { status: 404 });
    try { return new Response(await fs.readFile(path), { headers: { "Content-Type": mime[extname(path)] || "application/octet-stream" } }); }
    catch { return new Response("Not found", { status: 404 }); }
  },
};
const context = { waitUntil(promise) { promise.catch(() => undefined); }, passThroughOnException() {} };

const server = http.createServer(async (request, response) => {
  try {
    const incoming = new URL(request.url || "/", publicOrigin);
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
    let result = await assets.fetch(new Request(incoming));
    if (result.status === 404 && (incoming.pathname.startsWith("/api/") || incoming.pathname === "/_vinext/image")) {
      result = await fetch(`${publicOrigin}${incoming.pathname}${incoming.search}`, { headers: { Accept: request.headers.accept || "*/*" }, signal: AbortSignal.timeout(45_000) });
    } else if (result.status === 404) {
      result = await worker.fetch(new Request(incoming, { headers: request.headers }), { ASSETS: assets }, context);
    }
    const headers = Object.fromEntries(result.headers);
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
