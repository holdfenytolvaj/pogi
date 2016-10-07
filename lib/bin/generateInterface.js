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
const pgTable_1 = require("../pgTable");
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        let pgdb = yield pgDb_1.PgDb.connect({ logger: { log: () => { }, error: () => { } } }); //using PGUSER, PGPASSWORD + PGDATABASE env variables
        console.log('import {PgDb, PgSchema, PgTable} from "pgdb/lib/index";\n');
        console.log('export interface PgDbType extends PgDb {');
        console.log('    \'schemas\': {');
        for (let schemaName in pgdb.schemas) {
            console.log('        \'' + schemaName + '\': ' + schemaName + 'SchemaType;');
        }
        console.log('    }');
        console.log('}');
        for (let schemaName in pgdb.schemas) {
            console.log('export interface ' + schemaName + 'SchemaType extends PgSchema {');
            for (let tableName in pgdb.schemas[schemaName]) {
                if (pgdb.schemas[schemaName][tableName] instanceof pgTable_1.PgTable) {
                    console.log('    ' + tableName + ': PgTable;');
                }
            }
            console.log('}');
        }
        pgdb.close();
        return Promise.resolve();
    });
})();
//# sourceMappingURL=generateInterface.js.map