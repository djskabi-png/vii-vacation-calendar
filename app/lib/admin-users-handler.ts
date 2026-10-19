import type { D1Database } from "../../types/cloudflare-runtime";
import { AdminGrantError, ensureAdminGrantSchema, parseAdminGrantChange, readAdminGrantDashboard, saveAdminGrant } from "./admin-grants.ts";
type Dependencies = { authorize: (request: Request) => Promise<{ email: string } | null>; database: () => Promise<D1Database> };
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export function adminUsersHandler(dependencies: Dependencies) {
  return {
    async GET(request: Request) {
      const session = await dependencies.authorize(request);
      if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
      try {
        const db = await dependencies.database();
        await ensureAdminGrantSchema(db);
        return Response.json({ ...await readAdminGrantDashboard(db), actor: session.email.toLowerCase() }, { headers });
      } catch { return Response.json({ error: "admin_access_unavailable" }, { status: 503, headers }); }
    },
    async POST(request: Request) {
      const session = await dependencies.authorize(request);
      if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
      if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
      let input: unknown;
      try {
        const body = await request.text();
        if (body.length > 8192) return Response.json({ error: "too_large" }, { status: 413, headers });
        input = JSON.parse(body);
      } catch { return Response.json({ error: "invalid_input" }, { status: 400, headers }); }
      const change = parseAdminGrantChange(input);
      if (!change) return Response.json({ error: "invalid_input" }, { status: 400, headers });
      try {
        const db = await dependencies.database();
        await ensureAdminGrantSchema(db);
        return Response.json(await saveAdminGrant(db, change, session.email), { headers });
      } catch (error) {
        if (error instanceof AdminGrantError) return Response.json({ error: error.code }, { status: error.status, headers });
        return Response.json({ error: "admin_access_unavailable" }, { status: 503, headers });
      }
    },
  };
}
