import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { backendSourceMetadataResponse } from "../../../lib/backend-source-metadata.ts";
import { reportingDatabase } from "../../../lib/runtime-database.ts";

async function response(request: Request) {
  let sourceOrigin = "";
  let sourceDegraded = false;
  const result = await backendSourceMetadataResponse(request, {
    authorized: async (candidate) => !!await authorizedAdminSession(candidate),
    database: async () => {
      const source = await reportingDatabase();
      sourceOrigin = source.origin;
      sourceDegraded = source.degraded;
      return source.database;
    },
  });
  const responseHeaders = new Headers(result.headers);
  if (sourceOrigin) {
    responseHeaders.set("X-VII-Data-Origin", sourceOrigin);
    responseHeaders.set("X-VII-Degraded", String(sourceDegraded));
  }
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers: responseHeaders });
}

export function GET(request: Request) { return response(request); }
export function POST(request: Request) { return response(request); }
