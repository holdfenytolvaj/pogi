"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgDb = exports.TranzactionIsolationLevel = exports.FieldType = void 0;
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
const EventEmitter = require("events");
const CONNECTION_URL_REGEXP = /^postgres:\/\/(?:([^:]+)(?::([^@]*))?@)?([^\/:]+)?(?::([^\/]+))?\/(.*)$/;
const SQL_TOKENIZER_REGEXP = /''|'|""|"|;|\$|--|\/\*|\*\/|(.+?)/g;
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
    AND reltype>0 `;
const TYPE2OID = `SELECT t.oid, typname FROM pg_catalog.pg_type t WHERE typname in (
    '_bool',
    'int8','_int2','_int4','_int8','_float4','float8','_float8',
    '_text','_varchar',
    'json','jsonb', '_json','_jsonb',
    'date','time','timestamp','timestamptz','timetz','_date','_time','_timestamp','_timestamptz','_timetz', 
    'tsvector')`;
var FieldType;
(function (FieldType) {
    FieldType[FieldType["JSON"] = 0] = "JSON";
    FieldType[FieldType["ARRAY"] = 1] = "ARRAY";
    FieldType[FieldType["TIME"] = 2] = "TIME";
    FieldType[FieldType["TSVECTOR"] = 3] = "TSVECTOR";
})(FieldType = exports.FieldType || (exports.FieldType = {}));
var TranzactionIsolationLevel;
(function (TranzactionIsolationLevel) {
    TranzactionIsolationLevel["serializable"] = "SERIALIZABLE";
    TranzactionIsolationLevel["repeatableRead"] = "REPEATABLE READ";
    TranzactionIsolationLevel["readCommitted"] = "READ COMMITTED";
    TranzactionIsolationLevel["readUncommitted"] = "READ UNCOMMITTED";
})(TranzactionIsolationLevel = exports.TranzactionIsolationLevel || (exports.TranzactionIsolationLevel = {}));
class PgDb extends queryAble_1.QueryAble {
    constructor(pgdb = {}) {
        super();
        this.tables = {};
        this.fn = {};
        this.pgdbTypeParsers = {};
        this.knownOids = {};
        this.listeners = new EventEmitter();
        this._needToRestartConnectionForListen = false;
        this.restartConnectionForListen = null;
        this.notificationListener = (notification) => this.listeners.emit(notification.channel, notification);
        this.errorListener = (e) => {
            this._needToRestartConnectionForListen = true;
            this.tryToFixConnectionForListenActively();
        };
        this.schemas = {};
        this.config = pgdb.config;
        this.pool = pgdb.pool;
        this.postProcessResult = pgdb.postProcessResult;
        this.pgdbTypeParsers = pgdb.pgdbTypeParsers || {};
        this.knownOids = pgdb.knownOids || {};
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
            yield this.pool.end((err) => { });
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
            this.defaultSchemas = yield this.queryOneField(GET_CURRENT_SCHEMAS);
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
                this.getLogger(true).error("No readable schema found!");
                return;
            }
            let type2oid = {};
            let res = yield this.query(TYPE2OID);
            for (let tt of res || []) {
                type2oid[tt.typname] = +tt.oid;
            }
            let specialTypeFields = yield this.query(LIST_SPECIAL_TYPE_FIELDS + ' AND c.nspname in (' + schemaNames + ')');
            for (let r of specialTypeFields) {
                if (this.schemas[r.schema_name][r.table_name]) {
                    this.schemas[r.schema_name][r.table_name].fieldTypes[r.column_name] =
                        ([type2oid['json'], type2oid['jsonb']].indexOf(r.typid) > -1) ? FieldType.JSON :
                            ([type2oid['tsvector']].indexOf(r.typid) > -1) ? FieldType.TSVECTOR :
                                ([type2oid['date'], type2oid['time'], type2oid['timestamp'], type2oid['timestamptz'], type2oid['timetz']].indexOf(r.typid) > -1) ? FieldType.TIME :
                                    FieldType.ARRAY;
                }
            }
            let builtInArrayTypeParsers = [
                {
                    oidList: [
                        type2oid['_bool']
                    ],
                    parser: PgConverters.arraySplitToBool
                },
                {
                    oidList: [
                        type2oid['_int2'],
                        type2oid['_int4'],
                        type2oid['_float4'],
                    ],
                    parser: PgConverters.arraySplitToNum
                },
                {
                    oidList: [
                        type2oid['_text'],
                        type2oid['_varchar']
                    ],
                    parser: PgConverters.arraySplit
                },
                {
                    oidList: [
                        type2oid['_json'],
                        type2oid['_jsonb']
                    ],
                    parser: PgConverters.arraySplitToJson
                },
                {
                    oidList: [
                        type2oid['_date'],
                        type2oid['_time'],
                        type2oid['_timetz'],
                        type2oid['_timestamp'],
                        type2oid['_timestamptz'],
                    ],
                    parser: PgConverters.arraySplitToDate
                }
            ];
            builtInArrayTypeParsers.forEach(parserObj => {
                parserObj.oidList.forEach(oid => {
                    pg.types.setTypeParser(oid, parserObj.parser);
                    delete this.pgdbTypeParsers[oid];
                    this.knownOids[oid] = true;
                });
            });
            for (let r of specialTypeFields) {
                if (this.knownOids[r.typid] && !this.pgdbTypeParsers[r.typid]) {
                    continue;
                }
                switch (r.typid) {
                    case type2oid['json']:
                    case type2oid['jsonb']:
                    case type2oid['date']:
                    case type2oid['time']:
                    case type2oid['timetz']:
                    case type2oid['timestamp']:
                    case type2oid['timestamptz']:
                    case type2oid['tsvector']:
                    case type2oid['_int8']:
                    case type2oid['_float8']:
                        break;
                    default:
                        pg.types.setTypeParser(r.typid, PgConverters.arraySplit);
                        delete this.pgdbTypeParsers[r.typid];
                }
            }
            this.pgdbTypeParsers[type2oid['int8']] = PgConverters.numWithValidation;
            this.pgdbTypeParsers[type2oid['float8']] = PgConverters.numWithValidation;
            this.pgdbTypeParsers[type2oid['_int8']] = PgConverters.stringArrayToNumWithValidation;
            this.pgdbTypeParsers[type2oid['_float8']] = PgConverters.stringArrayToNumWithValidation;
            this.knownOids[type2oid['int8']] = true;
            this.knownOids[type2oid['float8']] = true;
            this.knownOids[type2oid['_int8']] = true;
            this.knownOids[type2oid['_float8']] = true;
            let allUsedTypeFields = yield this.queryOneColumn(`
            SELECT a.atttypid as typid
            FROM pg_attribute a
                JOIN pg_class b ON (a.attrelid = b.oid)
                JOIN pg_type t ON (a.atttypid = t.oid)
                JOIN pg_namespace c ON (b.relnamespace=c.oid)
            WHERE
                reltype>0 AND
                c.nspname in (${schemaNames})`);
            allUsedTypeFields.forEach(oid => this.knownOids[oid] = true);
        });
    }
    setTypeParser(typeName, parser, schemaName) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                if (schemaName) {
                    let oid = yield this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                    pg.types.setTypeParser(oid, parser);
                    delete this.pgdbTypeParsers[oid];
                    this.knownOids[oid] = true;
                }
                else {
                    let list = yield this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                    list.forEach(oid => {
                        pg.types.setTypeParser(oid, parser);
                        delete this.pgdbTypeParsers[oid];
                        this.knownOids[oid] = true;
                    });
                }
            }
            catch (e) {
                throw new Error('Not existing type: ' + typeName);
            }
        });
    }
    setPgDbTypeParser(typeName, parser, schemaName) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                if (schemaName) {
                    let oid = yield this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                    this.pgdbTypeParsers[oid] = parser;
                    this.knownOids[oid] = true;
                }
                else {
                    let list = yield this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                    list.forEach(oid => {
                        this.pgdbTypeParsers[oid] = parser;
                        this.knownOids[oid] = true;
                    });
                }
            }
            catch (e) {
                throw new Error('Not existing type: ' + typeName);
            }
        });
    }
    resetMissingParsers(connection, oidList) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let unknownOids = oidList.filter(oid => !this.knownOids[oid]);
            if (unknownOids.length) {
                let fieldsData = yield connection.query(`select oid, typcategory from pg_type where oid = ANY($1)`, [unknownOids]);
                fieldsData.rows.forEach(fieldData => {
                    if (fieldData.typcategory == 'A') {
                        this.pgdbTypeParsers[fieldData.oid] = PgConverters.arraySplit;
                    }
                    this.knownOids[fieldData.oid] = true;
                });
            }
        });
    }
    dedicatedConnectionBegin() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.needToFixConnectionForListen()) {
                yield this.runRestartConnectionForListen();
            }
            let pgDb = new PgDb(this);
            pgDb.connection = yield this.pool.connect();
            pgDb.connection.on('error', queryAble_1.QueryAble.connectionErrorListener);
            return pgDb;
        });
    }
    dedicatedConnectionEnd() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                this.connection.off('error', queryAble_1.QueryAble.connectionErrorListener);
                try {
                    yield this.connection.release();
                }
                catch (err) {
                    this.getLogger().error('Error while dedicated connection end.', err);
                }
                this.connection = null;
            }
            return this;
        });
    }
    savePoint(name) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.isTransactionActive()) {
                name = (name || '').replace(/"/g, '');
                yield this.query(`SAVEPOINT "${name}"`);
            }
            else {
                throw new Error('No active transaction');
            }
            return this;
        });
    }
    savePointRelease(name) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.isTransactionActive()) {
                name = (name || '').replace(/"/g, '');
                yield this.query(`RELEASE SAVEPOINT "${name}"`);
            }
            else {
                throw new Error('No active transaction');
            }
            return this;
        });
    }
    transactionBegin(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let pgDb = this.connection ? this : yield this.dedicatedConnectionBegin();
            let q = 'BEGIN';
            if (options === null || options === void 0 ? void 0 : options.isolationLevel) {
                q += ' ISOLATION LEVEL ' + options.isolationLevel;
            }
            if (options === null || options === void 0 ? void 0 : options.readOnly) {
                q += ' READ ONLY';
            }
            if (options === null || options === void 0 ? void 0 : options.deferrable) {
                q += ' DEFERRABLE ';
            }
            yield pgDb.query(q);
            return pgDb;
        });
    }
    transactionCommit() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.query('COMMIT');
            return this.dedicatedConnectionEnd();
        });
    }
    transactionRollback(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (options === null || options === void 0 ? void 0 : options.savePoint) {
                let name = (options.savePoint || '').replace(/"/g, '');
                yield this.query(`ROLLBACK TO SAVEPOINT "${name}"`);
                return this;
            }
            else {
                yield this.query('ROLLBACK');
                return this.dedicatedConnectionEnd();
            }
        });
    }
    isTransactionActive() {
        return this.connection != null;
    }
    execute(fileName, statementTransformerFunction) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let isTransactionInPlace = this.isTransactionActive();
            let pgdb = isTransactionInPlace ? this : yield this.dedicatedConnectionBegin();
            let runStatementList = (statementList) => {
                return new Promise((resolve, reject) => {
                    let currentStatement = 0;
                    let runStatement = () => {
                        if (statementList.length == currentStatement) {
                            resolve(undefined);
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
                let tmp = '', t;
                let consumer;
                let inQuotedString;
                let rl = readline.createInterface({
                    input: fs.createReadStream(fileName),
                    terminal: false
                }).on('line', (line) => {
                    lineCounter++;
                    try {
                        while (t = SQL_TOKENIZER_REGEXP.exec(line)) {
                            if (!inQuotedString && (t[0] == '"' || t[0] == "'") || inQuotedString == '"' || inQuotedString == "'") {
                                if (!inQuotedString) {
                                    inQuotedString = t[0];
                                }
                                else if (inQuotedString == t[0]) {
                                    inQuotedString = null;
                                }
                                tmp += t[0];
                            }
                            else if (!inQuotedString && t[0] == '$' || inQuotedString && inQuotedString[0] == '$') {
                                if (!inQuotedString) {
                                    let s = line.slice(SQL_TOKENIZER_REGEXP.lastIndex - 1);
                                    let token = s.match(SQL_$_ESCAPE_REGEXP);
                                    if (!token) {
                                        throw new Error('Invalid sql in line: ' + line);
                                    }
                                    inQuotedString = token[0];
                                    SQL_TOKENIZER_REGEXP.lastIndex += inQuotedString.length - 1;
                                    tmp += inQuotedString;
                                }
                                else {
                                    tmp += t[0];
                                    if (tmp.endsWith(inQuotedString)) {
                                        inQuotedString = null;
                                    }
                                }
                            }
                            else if (!inQuotedString && t[0] == '/*' || inQuotedString == '/*') {
                                if (!inQuotedString) {
                                    inQuotedString = t[0];
                                }
                                else if (t[0] == '*/') {
                                    inQuotedString = null;
                                }
                            }
                            else if (!inQuotedString && t[0] == '--') {
                                line = '';
                            }
                            else if (!inQuotedString && t[0] == ';') {
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
                            else {
                                tmp += t[0];
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
    listen(channel, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let restartConnectionError = null;
            if (this.needToFixConnectionForListen()) {
                restartConnectionError = yield this.runRestartConnectionForListen();
            }
            if (this.listeners.listenerCount(channel)) {
                this.listeners.on(channel, callback);
            }
            else {
                if (restartConnectionError) {
                    throw restartConnectionError;
                }
                try {
                    if (!this.connectionForListen) {
                        yield this.initConnectionForListen();
                    }
                    yield this.connectionForListen.query(`LISTEN "${channel}"`);
                }
                catch (err) {
                    this._needToRestartConnectionForListen = true;
                    throw err;
                }
                this.listeners.on(channel, callback);
            }
        });
    }
    unlisten(channel, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let restartConnectionError = null;
            if (this.needToFixConnectionForListen()) {
                restartConnectionError = yield this.runRestartConnectionForListen();
            }
            if (callback && this.listeners.listenerCount(channel) > 1) {
                this.listeners.removeListener(channel, callback);
            }
            else {
                if (restartConnectionError) {
                    throw restartConnectionError;
                }
                try {
                    yield this.internalQuery({ connection: this.connectionForListen, sql: `UNLISTEN "${channel}"` });
                    if (this.listeners.eventNames().length == 1) {
                        this.connectionForListen.removeAllListeners('notification');
                        this.connectionForListen.release();
                        this.connectionForListen = null;
                    }
                }
                catch (err) {
                    this._needToRestartConnectionForListen = true;
                    throw err;
                }
                this.listeners.removeAllListeners(channel);
            }
        });
    }
    notify(channel, payload) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.needToFixConnectionForListen()) {
                let restartConnectionError = yield this.runRestartConnectionForListen();
                if (restartConnectionError) {
                    throw restartConnectionError;
                }
            }
            let hasConnectionForListen = !!this.connectionForListen;
            let connection = this.connectionForListen || this.connection;
            let sql = 'SELECT pg_notify(:channel, :payload)';
            let params = { channel, payload };
            try {
                return this.internalQuery({ connection, sql, params });
            }
            catch (err) {
                if (hasConnectionForListen) {
                    this._needToRestartConnectionForListen = true;
                }
                throw err;
            }
        });
    }
    runRestartConnectionForListen() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this._needToRestartConnectionForListen) {
                return null;
            }
            let errorResult = null;
            if (!this.restartConnectionForListen) {
                this.restartConnectionForListen = (() => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    let eventNames = this.listeners.eventNames();
                    try {
                        this.connectionForListen.on('notification', this.notificationListener);
                        this.connectionForListen.on('error', this.errorListener);
                    }
                    catch (e) { }
                    try {
                        yield this.connectionForListen.release();
                    }
                    catch (e) { }
                    this.connectionForListen = null;
                    let error;
                    if (eventNames.length) {
                        try {
                            yield this.initConnectionForListen();
                            for (let channel of eventNames) {
                                yield this.connectionForListen.query(`LISTEN "${channel}"`);
                            }
                        }
                        catch (err) {
                            error = err;
                        }
                    }
                    return error;
                }))();
                errorResult = yield this.restartConnectionForListen;
                this.restartConnectionForListen = null;
            }
            else {
                errorResult = yield this.restartConnectionForListen;
            }
            if (!errorResult) {
                this._needToRestartConnectionForListen = false;
            }
            return errorResult;
        });
    }
    needToFixConnectionForListen() {
        return this._needToRestartConnectionForListen;
    }
    tryToFixConnectionForListenActively() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield new Promise(r => setTimeout(r, 1000));
            let error = yield this.runRestartConnectionForListen();
            if (error) {
                yield this.tryToFixConnectionForListenActively();
            }
        });
    }
    initConnectionForListen() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.connectionForListen = yield this.pool.connect();
            this.connectionForListen.on('notification', this.notificationListener);
            this.connectionForListen.on('error', this.errorListener);
        });
    }
}
exports.PgDb = PgDb;
exports.default = PgDb;
//# sourceMappingURL=pgDb.js.map