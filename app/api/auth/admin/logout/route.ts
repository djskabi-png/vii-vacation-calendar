import { ADMIN_SESSION_COOKIE, LEGACY_SESSION_COOKIE, clearCookie } from "../../../../lib/google-auth.ts";

export async function POST() {
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });
  headers.append("Set-Cookie", clearCookie(ADMIN_SESSION_COOKIE));
  headers.append("Set-Cookie", clearCookie(LEGACY_SESSION_COOKIE));
  return Response.json({ success: true }, { headers });
}
