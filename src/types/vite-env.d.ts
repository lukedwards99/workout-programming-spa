/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
}

interface Window {
  __sqlJs?: import('sql.js').SqlJsStatic | null;
  __liftlogE2E?: {
    flushPersistence(): Promise<void>;
  };
}
