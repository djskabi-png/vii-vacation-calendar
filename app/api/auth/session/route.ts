import { createSignedValue, CUSTOMER_SESSION_COOKIE, readCustomerSession, secureCookie } from "../../../lib/google-auth.ts";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function normalizeProfile(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as { name?: unknown; phone?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (name.length < 2 || name.length > 80) return null;
  if (phone && (phone.length < 7 || phone.length > 20 || !/^[0-9+() -]+$/.test(phone))) return null;
  return { name, phone: phone || undefined };
}

export async function GET(request: Request) {
  const session = await readCustomerSession(request);
  return Response.json({ account: session ? { name: session.name, email: session.email, phone: session.phone, picture: session.picture, provider: session.provider } : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const session = await readCustomerSession(request);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const profile = normalizeProfile(input);
  if (!profile) return Response.json({ error: "invalid_profile" }, { status: 422, headers: { "Cache-Control": "no-store" } });
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.max(now + 60, session.exp);
  const updated = { ...session, ...profile, exp };
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", secureCookie(CUSTOMER_SESSION_COOKIE, await createSignedValue(updated), Math.max(60, exp - now)));
  return Response.json({ account: { name: updated.name, email: updated.email, phone: updated.phone, picture: updated.picture, provider: updated.provider } }, { headers });
}
