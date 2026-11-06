import { experienceGateway } from '../../services/vii-edge-delivery/src/experience-gateway.ts';

export default {
  async fetch(request: Request, env: Parameters<typeof experienceGateway>[1]) {
    // Miniflare's host proxy rejects non-local Origin before invoking a Worker.
    // Carry the exact synthetic request as test data, without rewriting its URL
    // or Origin. Production gateway origin validation still runs unchanged.
    const input = await request.json() as { url: string; headers: Record<string,string>; payload: unknown };
    const target = new Request(input.url,{method:'POST',headers:input.headers,body:JSON.stringify(input.payload)});
    return await experienceGateway(target, env) ?? new Response('Not found', { status: 404 });
  },
};
