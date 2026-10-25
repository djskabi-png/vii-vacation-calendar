import { ADMIN_OAUTH_NONCE_COOKIE, CUSTOMER_OAUTH_NONCE_COOKIE, LEGACY_SESSION_COOKIE, clearCookie, cookieValue, createSignedValue, nonceCookieFor, readSignedValue, safeReturnTo, secureCookie, sessionCookieFor, type AuthAudience, type AuthenticatedAccount } from "../../../../lib/google-auth";

type State = { nonce: string; returnTo: string; audience: AuthAudience; exp: number };
type GoogleProfile = { sub?: string; name?: string; email?: string; email_verified?: boolean; picture?: string };
function failureAudience(request: Request, state: State | null): AuthAudience {
  if (state?.audience === "admin") return "admin";
  if (cookieValue(request, ADMIN_OAUTH_NONCE_COOKIE) && !cookieValue(request, CUSTOMER_OAUTH_NONCE_COOKIE)) return "admin";
  return "customer";
}
function failed(request: Request, origin: string, reason: string, state: State | null = null) {
  const audience = failureAudience(request, state);
  const location = audience === "admin" ? `${origin}/admin/login?authError=${encodeURIComponent(reason)}` : `${origin}/account?authError=${encodeURIComponent(reason)}`;
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(nonceCookieFor(audience)));
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = await readSignedValue<State>(url.searchParams.get("state") || undefined);
  if (url.searchParams.get("error")) return failed(request, url.origin, "cancelled", state);
  const audience = state?.audience === "admin" ? "admin" : state?.audience === "customer" ? "customer" : null;
  const nonce = audience ? cookieValue(request, nonceCookieFor(audience)) : undefined;
  if (!state || !audience || state.exp <= Math.floor(Date.now() / 1000) || !nonce || state.nonce !== nonce) return failed(request, url.origin, "invalid_state", state);
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!code || !clientId || !clientSecret) return failed(request, url.origin, "not_configured", state);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" }), signal: AbortSignal.timeout(12_000) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return failed(request, url.origin, "token_exchange_failed", state);
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.sub || !profile.name || !profile.email || profile.email_verified !== true) return failed(request, url.origin, "profile_unavailable", state);
    const account: AuthenticatedAccount & { exp: number } = { sub: profile.sub, name: profile.name, email: profile.email, picture: profile.picture, provider: "google", exp: Math.floor(Date.now() / 1000) + 604800 };
    const headers = new Headers({ Location: safeReturnTo(state.returnTo, audience), "Cache-Control": "no-store" });
    headers.append("Set-Cookie", secureCookie(sessionCookieFor(audience), await createSignedValue(account), 604800));
    headers.append("Set-Cookie", clearCookie(nonceCookieFor(audience)));
    headers.append("Set-Cookie", clearCookie(LEGACY_SESSION_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch { return failed(request, url.origin, "provider_unavailable", state); }
}
