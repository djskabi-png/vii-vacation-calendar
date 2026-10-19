import { readSession, type AuthenticatedAccount } from "./google-auth.ts";
import { resolveAdminAccess } from "./admin-grants.ts";
import { adminRouteAllowed } from "./admin-permissions.ts";

export type AdminSession = AuthenticatedAccount & { exp: number };

export async function authorizedAdminSession(request: Request, allowedEmails?: string[], database?: Parameters<typeof resolveAdminAccess>[1]): Promise<AdminSession | null> {
  const session = await readSession(request).catch(() => null);
  if (!session) return null;
  const email = session.email.trim().toLowerCase();
  if (allowedEmails) return allowedEmails.map((value) => value.trim().toLowerCase()).includes(email) ? session : null;
  const access = await resolveAdminAccess(email, database, session.sub);
  return access && adminRouteAllowed(access, new URL(request.url).pathname, request.method) ? session : null;
}
