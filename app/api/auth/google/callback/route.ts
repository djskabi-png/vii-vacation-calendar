import { OAUTH_NONCE_COOKIE, SESSION_COOKIE, clearCookie, cookieValue, createSignedValue, readSignedValue, safeReturnTo, secureCookie, type AuthenticatedAccount } from "../../../../lib/google-auth";

type State = { nonce: string; returnTo: string; exp: number };
type GoogleProfile = { sub?: string; name?: string; email?: string; email_verified?: boolean; picture?: string };
function failed(origin: string, reason: string) { return new Response(null, { status: 302, headers: { Location: `${origin}/account?authError=${encodeURIComponent(reason)}`, "Set-Cookie": clearCookie(OAUTH_NONCE_COOKIE), "Cache-Control": "no-store" } }); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return failed(url.origin, "cancelled");
  const state = await readSignedValue<State>(url.searchParams.get("state") || undefined);
  const nonce = cookieValue(request, OAUTH_NONCE_COOKIE);
  if (!state || state.exp <= Math.floor(Date.now() / 1000) || !nonce || state.nonce !== nonce) return failed(url.origin, "invalid_state");
  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!code || !clientId || !clientSecret) return failed(url.origin, "not_configured");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" }), signal: AbortSignal.timeout(12_000) });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return failed(url.origin, "token_exchange_failed");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.sub || !profile.name || !profile.email || profile.email_verified !== true) return failed(url.origin, "profile_unavailable");
    const account: AuthenticatedAccount & { exp: number } = { sub: profile.sub, name: profile.name, email: profile.email, picture: profile.picture, provider: "google", exp: Math.floor(Date.now() / 1000) + 604800 };
    const headers = new Headers({ Location: safeReturnTo(state.returnTo), "Cache-Control": "no-store" });
    headers.append("Set-Cookie", secureCookie(SESSION_COOKIE, await createSignedValue(account), 604800));
    headers.append("Set-Cookie", clearCookie(OAUTH_NONCE_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch { return failed(url.origin, "provider_unavailable"); }
}
