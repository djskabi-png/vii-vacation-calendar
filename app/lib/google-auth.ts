export type AuthAudience = "customer" | "admin";

export const CUSTOMER_SESSION_COOKIE = "vii_customer_session";
export const ADMIN_SESSION_COOKIE = "vii_admin_session";
export const LEGACY_SESSION_COOKIE = "vii_session";
export const CUSTOMER_OAUTH_NONCE_COOKIE = "vii_customer_oauth_nonce";
export const ADMIN_OAUTH_NONCE_COOKIE = "vii_admin_oauth_nonce";

// Kept as a source-compatible alias for public account code. New code should
// name the audience explicitly so an administrator can never become a
// customer merely by visiting a public page.
export const SESSION_COOKIE = CUSTOMER_SESSION_COOKIE;
export const OAUTH_NONCE_COOKIE = CUSTOMER_OAUTH_NONCE_COOKIE;

export type AuthenticatedAccount = { sub: string; name: string; email: string; picture?: string; provider: "google" };
const encoder = new TextEncoder();

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new Uint8Array([...atob(normalized)].map((character) => character.charCodeAt(0)));
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export function safeReturnTo(value: string | null, audience: AuthAudience = "customer") {
  const fallback = audience === "admin" ? "/admin" : "/account";
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://vii.local");
    if (url.origin !== "https://vii.local" || url.pathname.startsWith("/api/auth/")) return fallback;
    const adminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    if (audience === "admin" ? !adminPath : adminPath) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function authAudience(value: string | null, requested: string | null): AuthAudience {
  if (requested === "admin") return "admin";
  if (requested === "customer") return "customer";
  if (!value?.startsWith("/") || value.startsWith("//")) return "customer";
  try {
    const url = new URL(value, "https://vii.local");
    return url.origin === "https://vii.local" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) ? "admin" : "customer";
  } catch { return "customer"; }
}

export function sessionCookieFor(audience: AuthAudience) {
  return audience === "admin" ? ADMIN_SESSION_COOKIE : CUSTOMER_SESSION_COOKIE;
}

export function nonceCookieFor(audience: AuthAudience) {
  return audience === "admin" ? ADMIN_OAUTH_NONCE_COOKIE : CUSTOMER_OAUTH_NONCE_COOKIE;
}

export function authSecret() {
  const secret = process.env.VII_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("VII_AUTH_SECRET is not configured");
  return secret;
}

export async function createSignedValue(payload: Record<string, unknown>, secret = authSecret()) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${await signature(encoded, secret)}`;
}

export async function readSignedValue<T>(value: string | undefined, secret?: string): Promise<T | null> {
  if (!value) return null;
  const resolvedSecret = secret || authSecret();
  const [encoded, supplied, extra] = value.split(".");
  if (!encoded || !supplied || extra || !safeEqual(supplied, await signature(encoded, resolvedSecret))) return null;
  try { return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as T; } catch { return null; }
}

export function cookieValue(request: Request, name: string) {
  const match = (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name: string) { return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

async function readAudienceSession(request: Request, audience: AuthAudience) {
  const session = await readSignedValue<AuthenticatedAccount & { exp: number }>(cookieValue(request, sessionCookieFor(audience)));
  return session && session.exp > Math.floor(Date.now() / 1000) ? session : null;
}

export function readCustomerSession(request: Request) { return readAudienceSession(request, "customer"); }
export function readAdminSession(request: Request) { return readAudienceSession(request, "admin"); }
export const readSession = readCustomerSession;
