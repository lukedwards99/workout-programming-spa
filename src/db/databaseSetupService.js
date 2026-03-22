import {
    createDatabaseSQL,
    deleteDatabaseSQL
} from './sql.js';

let db;

export async function initDatabase(){

    const sqlModule = await import('sql.js');
    const initSqlJs = sqlModule.default || sqlModule;

    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

}