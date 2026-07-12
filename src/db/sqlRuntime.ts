export const SQL_WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm';

let initPromise: Promise<import('sql.js').SqlJsStatic> | null = null;

export function initSqlJs(): Promise<import('sql.js').SqlJsStatic> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const initSqlJsModule = (await import('sql.js')).default;
    const SQL = await initSqlJsModule({
      locateFile: () => SQL_WASM_URL,
    });
    (window as unknown as Record<string, unknown>).__sqlJs = SQL;
    return SQL;
  })();
  initPromise.catch(() => { initPromise = null; });
  return initPromise;
}

export function getSQL(): import('sql.js').SqlJsStatic | null {
  const s = (window as unknown as Record<string, unknown>).__sqlJs;
  return (s as import('sql.js').SqlJsStatic) ?? null;
}
