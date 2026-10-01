import application from './index';
import type { Bindings } from './types';

export interface EmbeddedAsset { body: string; contentType: string; etag: string }

export function createHostedWorker(assets: Record<string, EmbeddedAsset>) {
  return {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
      // No Static Assets binding: Access must authenticate this invocation directly.
      if (!ctx.access) return new Response('Cloudflare Access authentication is required.', {
        status: 403, headers: { 'Cache-Control': 'no-store' },
      });
      const path = new URL(request.url).pathname;
      if (path === '/api' || path.startsWith('/api/')) return application.fetch(request, env, ctx);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      const asset = Object.hasOwn(assets, path) ? assets[path]
        : !path.split('/').at(-1)?.includes('.') ? assets['/index.html'] : undefined;
      if (!asset) return new Response('Not found', { status: 404 });
      const headers = { 'Content-Type': asset.contentType, ETag: asset.etag,
        'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (request.headers.get('If-None-Match') === asset.etag) return new Response(null, { status: 304, headers });
      return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), char => char.charCodeAt(0)), { headers });
    },
    scheduled: application.scheduled,
  } satisfies ExportedHandler<Bindings>;
}
