type SqlJSValue = number | string | Uint8Array | null;
type SqlJSParams = SqlJSValue[];

declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: SqlJSValue[][];
  }

  export interface Statement {
    bind(params?: SqlJSParams): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlJSValue>;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayBufferView | Uint8Array);
    exec(sql: string, params?: SqlJSParams): QueryExecResult[];
    run(sql: string, params?: SqlJSParams): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsStatic {
    new (data?: ArrayBufferView | Uint8Array): Database;
    Database: typeof Database;
  }

  function default_1(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export default default_1;
}
