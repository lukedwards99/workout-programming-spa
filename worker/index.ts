import { Hono } from 'hono';
import { requireAuth } from './auth';
import type { AppEnv, Bindings } from './types';
import { ApiError, data, requirePlatformAdmin } from './lib';
import { sessionRoutes } from './routes/session';
import { adminRoutes } from './routes/admin';
import { libraryRoutes } from './routes/library';
import { programRoutes } from './routes/programs';
import { clientRoutes } from './routes/clients';
import { runHistoryRetention } from './maintenance';

const app = new Hono<AppEnv>();

app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  // Cookie-authenticated mutations must originate from this application.
  const origin = c.req.header('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && origin && origin !== new URL(c.req.url).origin) {
    throw new ApiError(403, 'invalid_origin', 'Cross-origin writes are not allowed.');
  }
  await next();
});

app.route('/api', sessionRoutes);

const protectedApi = new Hono<AppEnv>();
protectedApi.use('*', requireAuth);
protectedApi.route('/', adminRoutes);
protectedApi.route('/', libraryRoutes);
protectedApi.route('/', programRoutes);
protectedApi.route('/', clientRoutes);
protectedApi.post('/admin/maintenance/history-retention', async (c) => {
  requirePlatformAdmin(c.get('principal'));
  if (!['local', 'test'].includes(c.env.APP_ENV)) throw new ApiError(404, 'not_found', 'Local maintenance invocation is unavailable.');
  return data(c, await runHistoryRetention(c.env.DB));
});
app.route('/api', protectedApi);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found.' } }, 404));
app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    }, error.status);
  }
  console.error(error);
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  if (/UNIQUE constraint failed/i.test(message)) {
    return c.json({ error: { code: 'duplicate', message: 'A record with those values already exists.' } }, 409);
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return c.json({ error: { code: 'record_in_use', message: 'This record is still referenced by active data.' } }, 409);
  }
  return c.json({ error: { code: 'internal_error', message: 'Unexpected server error.' } }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runHistoryRetention(env.DB));
  },
} satisfies ExportedHandler<Bindings>;
