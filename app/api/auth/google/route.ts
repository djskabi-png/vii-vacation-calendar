import { OAUTH_NONCE_COOKIE, createSignedValue, safeReturnTo, secureCookie } from "../../../lib/google-auth";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) return new Response("Google sign-in is not configured", { status: 503 });
  const url = new URL(request.url);
  const nonce = crypto.randomUUID();
  const state = await createSignedValue({ nonce, returnTo: safeReturnTo(url.searchParams.get("returnTo")), exp: Math.floor(Date.now() / 1000) + 600 });
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${url.origin}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account", include_granted_scopes: "true" }).toString();
  return new Response(null, { status: 302, headers: { Location: authorize.toString(), "Set-Cookie": secureCookie(OAUTH_NONCE_COOKIE, nonce, 600), "Cache-Control": "no-store" } });
}
