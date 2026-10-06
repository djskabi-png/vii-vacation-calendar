export async function supplierToken() {
  try {
    const runtime = await import("cloudflare:workers");
    const token = (runtime.env as unknown as { SERGEY_VII_API_TOKEN?: string }).SERGEY_VII_API_TOKEN;
    if (token) return token;
  } catch { /* Local test runtime has no Cloudflare bindings. */ }
  return process.env.SERGEY_VII_API_TOKEN ?? "";
}
