import {PgDb} from "../pgDb";
import {PgTable} from "../pgTable";

(async function () {
    let pgdb = await PgDb.connect({logger:{log:()=>{},error:()=>{}}}); //using PGUSER, PGPASSWORD + PGDATABASE env variables

    console.log('import {PgDb, PgSchema, PgTable} from "pgdb/lib/index";\n')
    console.log('export interface PgDbType extends PgDb {');
    console.log('    \'schemas\': {');
    for (let schemaName in pgdb.schemas) {
        console.log('        \'' + schemaName +'\': ' + schemaName + 'SchemaType;');
    }
    console.log('    }');
    console.log('}');

    for (let schemaName in pgdb.schemas) {
        console.log('export interface '+ schemaName + 'SchemaType extends PgSchema {');
        for (let tableName in pgdb.schemas[schemaName]) {
            if (pgdb.schemas[schemaName][tableName] instanceof PgTable) {
                console.log('    ' + tableName + ': PgTable;');
            }
        }
        console.log('}');
    }


    pgdb.close();
    return Promise.resolve();
})();
