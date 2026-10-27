import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { resolveAdminAccess } from "../../../lib/admin-grants.ts";
import { answerProfessor, ProfessorQuestionError, professorHistory, professorQuota, saveProfessorQuota } from "../../../lib/admin-professor.ts";
import { reportingDatabase, requiredRuntimeDatabase, runtimeD1Database } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null); if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const [db, stateDb] = await Promise.all([requiredRuntimeDatabase("professor_unavailable"), runtimeD1Database()]);
  const access = await resolveAdminAccess(session.email, async () => db, session.sub);
  return Response.json({ quota: await professorQuota(stateDb, session.email), history: await professorHistory(stateDb, session.email), canManage: access?.manageUsers === true }, { headers });
}
export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null); if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { question?: unknown; action?: unknown; email?: unknown; limit?: unknown } | null;
  const [db, stateDb] = await Promise.all([requiredRuntimeDatabase("professor_unavailable"), runtimeD1Database()]);
  if (body?.action === "quota") { const access = await resolveAdminAccess(session.email, async () => db, session.sub); if (!access?.manageUsers) return Response.json({ error: "forbidden" }, { status: 403, headers }); const email = typeof body.email === "string" ? body.email : ""; const limit = Number(body.limit); if (!email.includes("@") || !Number.isSafeInteger(limit) || limit < 0 || limit > 500) return Response.json({ error: "invalid_input" }, { status: 400, headers }); return Response.json({ email, limit: await saveProfessorQuota(stateDb, email, limit, session.email) }, { headers }); }
  const question = typeof body?.question === "string" ? body.question.trim() : ""; if (!question || question.length > 800) return Response.json({ error: "invalid_question" }, { status: 400, headers });
  try {
    const report = await reportingDatabase();
    return Response.json({ answer: await answerProfessor(stateDb, session.email, question, report.database), quota: await professorQuota(stateDb, session.email) }, { headers });
  } catch (error) {
    if (error instanceof ProfessorQuestionError) return Response.json({ error: error.code, message: error.message }, { status: 422, headers });
    const code = error instanceof Error ? error.message : "professor_unavailable";
    return Response.json({ error: code }, { status: code === "quota_exceeded" ? 429 : 503, headers });
  }
}
