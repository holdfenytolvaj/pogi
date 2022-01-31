"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pgDb_1 = require("../pgDb");
const pgSchema_1 = require("../pgSchema");
const pgTable_1 = require("../pgTable");
(function () {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        try {
            let pgdb = yield pgDb_1.PgDb.connect({
                logger: {
                    log: () => {
                    }, error: console.error
                }
            });
            console.log('import {PgDb, PgSchema, PgTable} from "pogi";\n');
            console.log('export interface PgDbType extends PgDb {');
            for (let schemaName in pgdb.schemas) {
                if (!(pgdb[schemaName] instanceof pgSchema_1.PgSchema)) {
                    throw new Error('Already existing property: ' + schemaName + '!');
                }
                console.log(`    '${schemaName}': PgSchema_${schemaName};`);
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
                    if (!(pgdb[schemaName][tableName] instanceof pgTable_1.PgTable)) {
                        throw new Error('Already existing property: ' + tableName + ' on schema:' + schemaName + '!');
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
        }
        catch (e) {
            console.error(e);
        }
        return Promise.resolve();
    });
})();
//# sourceMappingURL=generateInterface.js.map