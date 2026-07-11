/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;
declare const __APP_VERSION__: string;

interface Window {
  __sqlJs?: import('sql.js').SqlJsStatic | null;
}
