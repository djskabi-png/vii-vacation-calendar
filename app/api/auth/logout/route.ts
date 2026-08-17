import { SESSION_COOKIE, clearCookie } from "../../../lib/google-auth";
export async function POST() { return Response.json({ success: true }, { headers: { "Set-Cookie": clearCookie(SESSION_COOKIE), "Cache-Control": "no-store" } }); }
