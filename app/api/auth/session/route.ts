import { readSession } from "../../../lib/google-auth";
export async function GET(request: Request) {
  const session = await readSession(request);
  return Response.json({ account: session ? { name: session.name, email: session.email, picture: session.picture, provider: session.provider } : null }, { headers: { "Cache-Control": "no-store" } });
}
