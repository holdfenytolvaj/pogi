"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const pgDb_1 = require("../pgDb");
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        let pgdb = yield pgDb_1.PgDb.connect({ logger: { log: () => { }, error: console.error } }); //using PGUSER, PGPASSWORD + PGDATABASE env variables
        console.log('import {PgDb, PgSchema, PgTable} from "pgdb";\n');
        console.log('export interface PgDbType extends PgDb {');
        for (let schemaName in pgdb.schemas) {
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
                console.log(`    '${tableName}': PgTable;`);
            }
            console.log(`    tables: {`);
            for (let tableName in pgdb.schemas[schemaName].tables) {
                console.log(`        '${tableName}': PgTable;`);
            }
            console.log('    }');
            console.log('}');
        }
        pgdb.close();
        return Promise.resolve();
    });
})();
//# sourceMappingURL=generateInterface.js.map