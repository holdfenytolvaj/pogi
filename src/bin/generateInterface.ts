import {PgDb} from "../pgDb";
import {PgSchema} from "../pgSchema";
import {PgTable} from "../pgTable";

(async function () {
    try {
        let pgdb = await PgDb.connect({
            logger: {
                log: ()=> {
                }, error: console.error
            }
        }); //using PGUSER, PGPASSWORD + PGDATABASE env variables

        console.log('import {PgDb, PgSchema, PgTable} from "pgdb";\n');
        console.log('export interface PgDbType extends PgDb {');

        for (let schemaName in pgdb.schemas) {
            if (!(pgdb[schemaName] instanceof PgSchema)) {
                throw Error('Already existing property: ' + schemaName + '!');
            }
            console.log(`    '${schemaName}': PgSchema_${schemaName};`); //need to add a PgSchema_ prefix in order to handle schemas starting with number
        }

        console.log(`    'schemas': {`);
        for (let schemaName in pgdb.schemas) {
            console.log(`        '${schemaName}': PgSchema_${schemaName};`);
        }
        console.log('    }');
        console.log('}');

        for (let schemaName in pgdb.schemas) {
            console.log(`export interface PgSchema_${schemaName} extends PgSchema {`);
            for (let tableName in pgdb.schemas[schemaName].tables) {
                if (!(pgdb[schemaName][tableName] instanceof PgTable)) {
                    throw Error('Already existing property: ' + tableName + ' on schema:' + schemaName + '!');
                }
                console.log(`    '${tableName}': PgTable<any>;`);
            }
            console.log(`    tables: {`);
            for (let tableName in pgdb.schemas[schemaName].tables) {
                console.log(`        '${tableName}': PgTable<any>;`);
            }
            console.log('    }');

            console.log('}');
        }


        pgdb.close();
    } catch(e) {
        console.error(e);
    }
    return Promise.resolve();
})();
