import type { D1Database } from "../../types/cloudflare-runtime";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { readSupplierCatalogState } from "./supplier-catalog-store.ts";

const versions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const worlds: SupplierCatalogWorld[] = ["vacations", "events", "rooms", "spa"];
const responseHeaders = { "Cache-Control": "no-store" };
const statusTool = {
  name: "vii_catalog_status",
  description: "Read the current VII catalog source and counts. Requires a Sites-authenticated account in the existing administrator allowlist. Does not fetch suppliers or change data.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
const pullTool = {
  name: "vii_catalog_pull",
  description: "Administrator-only guarded catalog pull for today's latest approved Israel-time slot. Each world/slot runs at most once, including failures. Preserves removal and media guards. Returns persisted run metadata only. No booking operations.",
  inputSchema: { type: "object", properties: { world: { type: "string", enum: worlds } }, required: ["world"], additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function error(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status, headers: responseHeaders });
}

export async function catalogStatusMcp(request: Request, dependencies: {
  adminEmails: () => Promise<string>;
  database: () => Promise<D1Database>;
  fallbackCounts: Record<SupplierCatalogWorld, number>;
  pull?: (world: SupplierCatalogWorld) => Promise<unknown>;
}) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== "https://chatgpt.com") {
    return error(null, -32000, "Invalid origin", 403);
  }
  const protocol = request.headers.get("mcp-protocol-version");
  if (protocol && !versions.includes(protocol)) return error(null, -32600, "Unsupported protocol version", 400);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return error(null, -32600, "JSON required", 415);
  }
  let message: Record<string, unknown> | null;
  try { message = object(await request.json()); } catch { return error(null, -32700, "Parse error", 400); }
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string"
    || (message.id !== undefined && typeof message.id !== "string" && typeof message.id !== "number")) {
    return error(null, -32600, "Invalid request", 400);
  }
  if (message.id === undefined) {
    if (message.method === "notifications/initialized") return new Response(null, { status: 202, headers: responseHeaders });
    return error(null, -32600, "Unsupported notification", 400);
  }
  const result = (value: unknown) => Response.json({ jsonrpc: "2.0", id: message.id, result: value }, { headers: responseHeaders });
  // Discovery contains no catalog data, identity, environment values or private records.
  if (message.method === "initialize") {
    const requested = object(message.params)?.protocolVersion;
    return result({ protocolVersion: typeof requested === "string" && versions.includes(requested) ? requested : versions[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "vii-catalog-status", title: "VII catalog status", version: "1.0.0" } });
  }
  if (message.method === "ping") return result({});
  if (message.method === "tools/list") return result({ tools: dependencies.pull ? [statusTool, pullTool] : [statusTool] });
  if (message.method !== "tools/call") return error(message.id, -32601, "Method not found");

  // Sites dispatch supplies these authenticated identity headers. Service access alone is insufficient.
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!userId || !email) return error(message.id, -32001, "Authentication required", 401);
  let allowed: string[];
  try { allowed = (await dependencies.adminEmails()).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean); }
  catch { return error(message.id, -32003, "Authorization unavailable", 403); }
  if (!allowed.includes(email)) return error(message.id, -32003, "Forbidden", 403);
  const params = object(message.params);
  if (params?.name === pullTool.name && dependencies.pull) {
    const args = object(params.arguments);
    if (!args || Object.keys(args).length !== 1 || typeof args.world !== "string"
      || !worlds.includes(args.world as SupplierCatalogWorld)) return error(message.id, -32602, "One catalog world required");
    try {
      const value = await dependencies.pull(args.world as SupplierCatalogWorld);
      return result({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false });
    } catch {
      return result({ content: [{ type: "text", text: "Catalog pull unavailable" }], isError: true });
    }
  }
  if (params?.name !== statusTool.name) return error(message.id, -32602, "Unknown tool");
  const args = params.arguments === undefined ? {} : object(params.arguments);
  if (!args || Object.keys(args).length) return error(message.id, -32602, "This tool takes no arguments");
  try {
    const db = await dependencies.database();
    const catalogs = await Promise.all(worlds.map(async (world) => {
      const state = await readSupplierCatalogState(db, world);
      return { world, source: state?.activeRunId ? "runtime" : "bundled-fallback",
        count: state?.activeRunId ? state.activeCount : dependencies.fallbackCounts[world] };
    }));
    const status = { readOnly: true, callerAuthenticated: true, callerAuthorized: true,
      identitySource: "sites-request-identity", authorization: "existing-admin-allowlist", catalogs };
    return result({ content: [{ type: "text", text: JSON.stringify(status) }], structuredContent: status, isError: false });
  } catch {
    // Never return or log exception text, D1 records, headers, identity or credentials.
    return result({ content: [{ type: "text", text: "Catalog status unavailable" }], isError: true });
  }
}
