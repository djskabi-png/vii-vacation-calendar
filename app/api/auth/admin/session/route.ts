import { resolveAdminAccess } from "../../../../lib/admin-grants.ts";
import { readAdminSession } from "../../../../lib/google-auth.ts";

export async function GET(request: Request) {
  const session = await readAdminSession(request).catch(() => null);
  const access = session ? await resolveAdminAccess(session.email, undefined, session.sub).catch(() => null) : null;
  return Response.json({
    account: session && access ? { name: session.name, email: session.email, picture: session.picture, provider: session.provider } : null,
  }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", Vary: "Cookie" } });
}
