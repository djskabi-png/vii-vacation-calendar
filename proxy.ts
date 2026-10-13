import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redirectForPath, redirectLookupDatabase, shouldCheckRedirect } from "./app/lib/admin-redirects";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (!shouldCheckRedirect(path)) return NextResponse.next();
  try {
    const redirect = await redirectForPath(await redirectLookupDatabase(), path);
    if (!redirect) return NextResponse.next();
    if (redirect.status === 410) return new Response("Gone", { status: 410, headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
    if (redirect.status === 301 && redirect.target_path) {
      const url = new URL(redirect.target_path, request.url);
      request.nextUrl.searchParams.forEach((value, key) => { if (!url.searchParams.has(key)) url.searchParams.append(key, value); });
      return NextResponse.redirect(url, 301);
    }
  } catch (error) {
    const expectedUnavailable = error instanceof Error &&
      (/ERR_UNSUPPORTED_ESM_URL_SCHEME|no such table: vii_redirects/i.test(`${error.message} ${"code" in error ? error.code : ""}`));
    if (!expectedUnavailable) console.error("VII redirect lookup unavailable", error);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api/|admin/|_next/|_vinext/|assets/).*)"] };

