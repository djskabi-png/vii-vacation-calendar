import { readSession, type AuthenticatedAccount } from "./google-auth.ts";
import { adminEmails } from "./admin-access.ts";

export type AdminSession = AuthenticatedAccount & { exp: number };

export async function authorizedAdminSession(request: Request, allowedEmails = adminEmails()): Promise<AdminSession | null> {
  const session = await readSession(request).catch(() => null);
  if (!session) return null;
  const email = session.email.trim().toLowerCase();
  return allowedEmails.map((value) => value.trim().toLowerCase()).includes(email) ? session : null;
}
