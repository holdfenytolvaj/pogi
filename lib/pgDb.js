"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const queryAble_1 = require("./queryAble");
const pgTable_1 = require("./pgTable");
const pgSchema_1 = require("./pgSchema");
const PgConverters = require("./pgConverters");
const pgUtils_1 = require("./pgUtils");
const _ = require("lodash");
const pg = require("pg");
const readline = require("readline");
const fs = require("fs");
const extsprintf_1 = require("extsprintf");
const CONNECTION_URL_REGEXP = /^postgres:\/\/(?:([^:]+)(?::([^@]*))?@)?([^\/:]+)?(?::([^\/]+))?\/(.*)$/;
const SQL_TOKENIZER_REGEXP = /''|'|""|"|;|\$|--|(.+?)/g;
const SQL_$_ESCAPE_REGEXP = /\$[^$]*\$/g;
const LIST_SCHEMAS_TABLES = `SELECT table_schema as schema, table_name as name 
     FROM information_schema.tables 
     WHERE table_schema NOT IN ('pg_catalog', 'pg_constraint', 'information_schema')`;
const GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA = "SELECT t.oid FROM pg_catalog.pg_type t, pg_namespace n WHERE typname=:typeName and n.oid=t.typnamespace and n.nspname=:schemaName;";
const GET_OID_FOR_COLUMN_TYPE = "SELECT t.oid FROM pg_catalog.pg_type t WHERE typname=:typeName";
const GET_SCHEMAS_PROCEDURES = `SELECT
    n.nspname as "schema",
    p.proname as "name",
    (not p.proretset) as "return_single_row",
    (t.typtype in ('b', 'd', 'e', 'r')) as "return_single_value"
FROM pg_proc p
     inner join pg_namespace n on (p.pronamespace = n.oid)
     inner join pg_type t on (p.prorettype = t.oid)
     left outer join pg_trigger tr on (tr.tgfoid = p.oid)
WHERE n.nspname NOT IN ('pg_catalog', 'pg_constraint', 'information_schema')
  AND tr.oid is null;`;
const GET_CURRENT_SCHEMAS = "SELECT current_schemas(false)";
const LIST_SPECIAL_TYPE_FIELDS = `SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as typid 
    FROM pg_attribute a 
    JOIN pg_class b ON (a.attrelid = b.oid)
    JOIN pg_type t ON (a.atttypid = t.oid)
    JOIN pg_namespace c ON (b.relnamespace=c.oid) 
    WHERE (a.atttypid in (114, 3802, 1082, 1083, 1114, 1184, 1266, 3614) or t.typcategory='A')
    AND reltype>0
    AND c.nspname in (%s) `;
var FieldType;
(function (FieldType) {
    FieldType[FieldType["JSON"] = 0] = "JSON";
    FieldType[FieldType["ARRAY"] = 1] = "ARRAY";
    FieldType[FieldType["TIME"] = 2] = "TIME";
    FieldType[FieldType["TSVECTOR"] = 3] = "TSVECTOR";
})(FieldType = exports.FieldType || (exports.FieldType = {}));
class PgDb extends queryAble_1.QueryAble {
    constructor(pgdb = {}) {
        super();
        this.tables = {};
        this.fn = {};
        this.pgdbTypeParsers = {};
        this.schemas = {};
        this.config = pgdb.config;
        this.pool = pgdb.pool;
        this.postProcessResult = pgdb.postProcessResult;
        this.pgdbTypeParsers = pgdb.pgdbTypeParsers || {};
        this.db = this;
        if (pgdb.getLogger) {
            this.setLogger(pgdb.getLogger());
        }
        for (let schemaName in pgdb.schemas) {
            let schema = new pgSchema_1.PgSchema(this, schemaName);
            this.schemas[schemaName] = schema;
            if (!(schemaName in this))
                this[schemaName] = schema;
            for (let tableName in pgdb.schemas[schemaName].tables) {
                schema.tables[tableName] = new pgTable_1.PgTable(schema, pgdb.schemas[schemaName][tableName].desc, pgdb.schemas[schemaName][tableName].fieldTypes);
                if (!(tableName in schema))
                    schema[tableName] = schema.tables[tableName];
            }
        }
        this.defaultSchemas = pgdb.defaultSchemas;
        this.setDefaultTablesAndFunctions();
    }
    setPostProcessResult(f) {
        this.postProcessResult = f;
    }
    static getInstance(config) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (config.connectionString) {
                let res = CONNECTION_URL_REGEXP.exec(config.connectionString);
                if (res) {
                    config.user = res[1];
                    config.password = res[2] ? res[2] : '';
                    config.host = res[3] ? res[3] : 'localhost';
                    config.port = res[4] ? +res[4] : 5432;
                    config.database = res[5];
                }
            }
            let connectionString = `postgres://${config.user}@${config.host}:${config.port}/${config.database}`;
            if (!PgDb.instances) {
                PgDb.instances = {};
            }
            if (PgDb.instances[connectionString]) {
                return PgDb.instances[connectionString];
            }
            else {
                let pgdb = new PgDb({ config: config });
                PgDb.instances[connectionString] = pgdb.init();
                return PgDb.instances[connectionString];
            }
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (let cs in PgDb.instances) {
                let db = yield PgDb.instances[cs];
                if (db.pool == this.pool) {
                    delete PgDb.instances[cs];
                }
            }
            yield this.pool.end();
        });
    }
    static connect(config) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (config.connectionString) {
                let res = CONNECTION_URL_REGEXP.exec(config.connectionString);
                if (res) {
                    config.user = res[1];
                    if (res[2])
                        config.password = res[2];
                    config.host = res[3] ? res[3] : 'localhost';
                    config.port = res[4] ? +res[4] : 5432;
                    config.database = res[5];
                }
            }
            let pgdb = new PgDb({ config: config });
            return pgdb.init();
        });
    }
    init() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.pool = new pg.Pool(_.omit(this.config, ['logger', 'skipUndefined']));
            if (this.config.logger)
                this.setLogger(this.config.logger);
            this.pool.on('error', (e, client) => {
                this.getLogger(true).error('pool error', e);
            });
            yield this.reload();
            this.getLogger().log('Successfully connected to Db');
            return this;
        });
    }
    reload() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.initSchemasAndTables();
            yield this.initFieldTypes();
        });
    }
    initSchemasAndTables() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let schemasAndTables = yield this.query(LIST_SCHEMAS_TABLES);
            let functions = yield this.query(GET_SCHEMAS_PROCEDURES);
            this.defaultSchemas = PgConverters.arraySplit(yield this.queryOneField(GET_CURRENT_SCHEMAS));
            let oldSchemaNames = Object.keys(this.schemas);
            for (let sc of oldSchemaNames) {
                if (this[sc] === this.schemas[sc])
                    delete this[sc];
            }
            this.schemas = {};
            for (let r of schemasAndTables) {
                let schema = this.schemas[r.schema] = this.schemas[r.schema] || new pgSchema_1.PgSchema(this, r.schema);
                if (!(r.schema in this))
                    this[r.schema] = schema;
                schema.tables[r.name] = new pgTable_1.PgTable(schema, r);
                if (!(r.name in schema))
                    schema[r.name] = schema.tables[r.name];
            }
            for (let r of functions) {
                let schema = this.schemas[r.schema] = this.schemas[r.schema] || new pgSchema_1.PgSchema(this, r.schema);
                if (!(r.schema in this))
                    this[r.schema] = schema;
                schema.fn[r.name] = pgUtils_1.pgUtils.createFunctionCaller(schema, r);
            }
            this.setDefaultTablesAndFunctions();
        });
    }
    setDefaultTablesAndFunctions() {
        this.tables = {};
        this.fn = {};
        if (!this.defaultSchemas)
            return;
        for (let sc of this.defaultSchemas) {
            let schema = this.schemas[sc];
            if (!schema)
                continue;
            for (let table in schema.tables)
                this.tables[table] = this.tables[table] || schema.tables[table];
            for (let fn in schema.fn)
                this.fn[fn] = this.fn[fn] || schema.fn[fn];
        }
    }
    initFieldTypes() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let schemaNames = "'" + Object.keys(this.schemas).join("', '") + "'";
            if (schemaNames == "''") {
                throw new Error("No readable schema found");
            }
            let q = extsprintf_1.sprintf(LIST_SPECIAL_TYPE_FIELDS, schemaNames);
            console.log("GGG");
            console.log(q);
            let specialTypeFields = yield this.query(q);
            for (let r of specialTypeFields) {
                if (this.schemas[r.schema_name][r.table_name]) {
                    this.schemas[r.schema_name][r.table_name].fieldTypes[r.column_name] =
                        ([3802, 114].indexOf(r.typid) > -1) ? FieldType.JSON :
                            ([3614].indexOf(r.typid) > -1) ? FieldType.TSVECTOR :
                                ([1082, 1083, 1114, 1184, 1266].indexOf(r.typid) > -1) ? FieldType.TIME :
                                    FieldType.ARRAY;
                }
            }
            for (let r of specialTypeFields) {
                switch (r.typid) {
                    case 114:
                    case 3802:
                    case 1082:
                    case 1083:
                    case 1114:
                    case 1184:
                    case 1266:
                    case 3614:
                        break;
                    case 1005:
                    case 1007:
                    case 1021:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplitToNum);
                        break;
                    case 1009:
                    case 1015:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplit);
                        break;
                    case 3807:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplitToJson);
                        break;
                    case 1016:
                    case 1022:
                        break;
                    case 1115:
                    case 1182:
                    case 1183:
                    case 1185:
                    case 1270:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplitToDate);
                        break;
                    default:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplit);
                }
            }
            yield this.setPgDbTypeParser('int8', PgConverters.numWithValidation);
            yield this.setPgDbTypeParser('float8', PgConverters.numWithValidation);
            yield this.setPgDbTypeParser('_int8', PgConverters.stringArrayToNumWithValidation);
            yield this.setPgDbTypeParser('_float8', PgConverters.stringArrayToNumWithValidation);
        });
    }
    setTypeParser(typeName, parser, schemaName) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                if (schemaName) {
                    let oid = yield this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                    pg.types.setTypeParser(oid, parser);
                    delete this.pgdbTypeParsers[oid];
                }
                else {
                    let list = yield this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                    list.forEach(oid => {
                        pg.types.setTypeParser(oid, parser);
                        delete this.pgdbTypeParsers[oid];
                    });
                }
            }
            catch (e) {
                throw Error('Not existing type: ' + typeName);
            }
        });
    }
    setPgDbTypeParser(typeName, parser, schemaName) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                if (schemaName) {
                    let oid = yield this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                    this.pgdbTypeParsers[oid] = parser;
                }
                else {
                    let list = yield this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                    list.forEach(oid => this.pgdbTypeParsers[oid] = parser);
                }
            }
            catch (e) {
                throw Error('Not existing type: ' + typeName);
            }
        });
    }
    dedicatedConnectionBegin() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                return this;
            }
            else {
                let pgDb = new PgDb(this);
                pgDb.connection = yield this.pool.connect();
                return pgDb;
            }
        });
    }
    dedicatedConnectionEnd() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                yield this.connection.release();
                this.connection = null;
            }
            return this;
        });
    }
    transactionBegin() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let pgDb = yield this.dedicatedConnectionBegin();
            yield pgDb.query('BEGIN');
            return pgDb;
        });
    }
    transactionCommit() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.query('COMMIT');
            return this.dedicatedConnectionEnd();
        });
    }
    transactionRollback() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.query('ROLLBACK');
            return this.dedicatedConnectionEnd();
        });
    }
    isTransactionActive() {
        return this.connection != null;
    }
    execute(fileName, statementTransformerFunction) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let isTransactionInPlace = this.isTransactionActive();
            let pgdb = yield this.dedicatedConnectionBegin();
            let runStatementList = (statementList) => {
                return new Promise((resolve, reject) => {
                    let currentStatement = 0;
                    let runStatement = () => {
                        if (statementList.length == currentStatement) {
                            resolve();
                        }
                        else {
                            let statement = statementList[currentStatement++];
                            if (statementTransformerFunction) {
                                statement = statementTransformerFunction(statement);
                            }
                            this.getLogger(true).log('run', statementList[currentStatement - 1]);
                            pgdb.query(statement)
                                .then(() => runStatement(), reject)
                                .catch(reject);
                        }
                    };
                    runStatement();
                }).catch((e) => {
                    this.getLogger(true).error(e);
                    throw e;
                });
            };
            let lineCounter = 0;
            let promise = new Promise((resolve, reject) => {
                let statementList = [];
                let tmp = '', m;
                let consumer;
                let inQuotedString;
                let rl = readline.createInterface({
                    input: fs.createReadStream(fileName),
                    terminal: false
                }).on('line', (line) => {
                    lineCounter++;
                    try {
                        while (m = SQL_TOKENIZER_REGEXP.exec(line)) {
                            if (m[0] == '"' || m[0] == "'") {
                                if (!inQuotedString) {
                                    inQuotedString = m[0];
                                }
                                else if (inQuotedString == m[0]) {
                                    inQuotedString = null;
                                }
                                tmp += m[0];
                            }
                            else if (m[0] == '$' && (!inQuotedString || inQuotedString[0] == '$')) {
                                if (!inQuotedString) {
                                    let s = line.slice(SQL_TOKENIZER_REGEXP.lastIndex - 1);
                                    let token = s.match(SQL_$_ESCAPE_REGEXP);
                                    if (!token) {
                                        throw Error('Invalid sql in line: ' + line);
                                    }
                                    inQuotedString = token[0];
                                    SQL_TOKENIZER_REGEXP.lastIndex += inQuotedString.length - 1;
                                    tmp += inQuotedString;
                                }
                                else {
                                    tmp += m[0];
                                    if (tmp.endsWith(inQuotedString)) {
                                        inQuotedString = null;
                                    }
                                }
                            }
                            else if (!inQuotedString && m[0] == ';') {
                                if (tmp.trim() != '') {
                                    statementList.push(tmp);
                                    if (!consumer) {
                                        consumer = runStatementList(statementList).then(() => {
                                            consumer = null;
                                            statementList.length = 0;
                                            rl.resume();
                                        }, reject);
                                        rl.pause();
                                    }
                                }
                                tmp = '';
                            }
                            else if (!inQuotedString && m[0].substring(0, 2) == '--') {
                                line = '';
                            }
                            else {
                                tmp += m[0];
                            }
                        }
                        if (tmp && line) {
                            tmp += '\n';
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                }).on('close', () => {
                    if (inQuotedString) {
                        reject(Error('Invalid SQL, unterminated string'));
                    }
                    if (tmp.trim() != '') {
                        statementList.push(tmp);
                    }
                    if (!consumer) {
                        if (statementList.length) {
                            consumer = runStatementList(statementList).catch(reject);
                        }
                        else {
                            resolve();
                        }
                    }
                    if (consumer) {
                        consumer = consumer.then(resolve, reject);
                    }
                });
            });
            let error;
            return promise
                .catch((e) => {
                error = e;
                this.getLogger(true).error('Error at line ' + lineCounter + ' in ' + fileName + '. ' + e);
            })
                .then(() => {
                if (!isTransactionInPlace) {
                    return pgdb.dedicatedConnectionEnd();
                }
            }).catch((e) => {
                this.getLogger(true).error(e);
            }).then(() => {
                if (error) {
                    throw error;
                }
            });
        });
    }
}
exports.PgDb = PgDb;
exports.default = PgDb;
//# sourceMappingURL=pgDb.js.map