import { CUSTOMER_SESSION_COOKIE, LEGACY_SESSION_COOKIE, clearCookie } from "../../../lib/google-auth.ts";
export async function POST() {
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(CUSTOMER_SESSION_COOKIE));
  headers.append("Set-Cookie", clearCookie(LEGACY_SESSION_COOKIE));
  return Response.json({ success: true }, { headers });
}
