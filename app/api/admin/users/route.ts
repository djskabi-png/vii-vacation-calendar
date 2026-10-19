import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { adminGrantDatabase } from "../../../lib/admin-grants.ts";
import { adminUsersHandler } from "../../../lib/admin-users-handler.ts";
const handlers = adminUsersHandler({ authorize: authorizedAdminSession, database: adminGrantDatabase });
export async function GET(request: Request) { return handlers.GET(request); }
export async function POST(request: Request) { return handlers.POST(request); }
