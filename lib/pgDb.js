import EventEmitter from 'events';
import fs from 'fs';
import _ from 'lodash';
import pg from 'pg';
import readline from 'readline';
import * as PgConverters from "./pgConverters.js";
import { PgSchema } from "./pgSchema.js";
import { PgTable } from "./pgTable.js";
import { pgUtils } from "./pgUtils.js";
import { QueryAble } from "./queryAble.js";
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
const LIST_SPECIAL_TYPE_FIELDS = `SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as typid, t.typcategory
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
export var FieldType;
(function (FieldType) {
    FieldType[FieldType["JSON"] = 0] = "JSON";
    FieldType[FieldType["ARRAY"] = 1] = "ARRAY";
    FieldType[FieldType["TIME"] = 2] = "TIME";
    FieldType[FieldType["TSVECTOR"] = 3] = "TSVECTOR";
})(FieldType || (FieldType = {}));
export class PgDb extends QueryAble {
    static instances;
    pool;
    connection = null;
    config;
    defaultSchemas;
    db;
    schemas;
    tables = {};
    fn = {};
    pgdbTypeParsers = {};
    knownOids = {};
    postProcessResult;
    constructor(pgdb) {
        super();
        this.schemas = {};
        this.config = pgdb.config || {};
        this.pool = pgdb.pool;
        this.postProcessResult = pgdb.postProcessResult;
        this.pgdbTypeParsers = pgdb.pgdbTypeParsers || {};
        this.knownOids = pgdb.knownOids || {};
        this.db = this;
        if (pgdb.getLogger) {
            this.setLogger(pgdb.getLogger());
        }
        for (let schemaName in pgdb.schemas) {
            let schema = new PgSchema(this, schemaName);
            this.schemas[schemaName] = schema;
            if (!(schemaName in this))
                this[schemaName] = schema;
            for (let tableName in pgdb.schemas[schemaName].tables) {
                schema.tables[tableName] = new PgTable(schema, pgdb.schemas[schemaName][tableName].desc, pgdb.schemas[schemaName][tableName].fieldTypes);
                if (!(tableName in schema))
                    schema[tableName] = schema.tables[tableName];
            }
        }
        this.defaultSchemas = pgdb.defaultSchemas || [];
        this.setDefaultTablesAndFunctions();
    }
    setPostProcessResult(f) {
        this.postProcessResult = f;
    }
    static async getInstance(config) {
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
        if (PgDb.instances[connectionString] != null) {
            return PgDb.instances[connectionString];
        }
        else {
            let pgdb = new PgDb({ config: config });
            PgDb.instances[connectionString] = pgdb.init();
            return PgDb.instances[connectionString];
        }
    }
    async close() {
        for (let cs in PgDb.instances) {
            let db = await PgDb.instances[cs];
            if (db.pool == this.pool) {
                delete PgDb.instances[cs];
            }
        }
        await new Promise((resolve) => this.pool.end(resolve));
    }
    static async connect(config) {
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
    }
    async init() {
        this.pool = new pg.Pool(_.omit(this.config, ['logger', 'skipUndefined']));
        if (this.config.logger)
            this.setLogger(this.config.logger);
        this.pool.on('error', (e, client) => {
            this.getLogger(true).error('pool error', e);
        });
        await this.reload();
        this.getLogger().log('Successfully connected to Db');
        return this;
    }
    async reload() {
        await this.initSchemasAndTables();
        await this.initFieldTypes();
    }
    async initSchemasAndTables() {
        let schemasAndTables = await this.query(LIST_SCHEMAS_TABLES);
        let functions = await this.query(GET_SCHEMAS_PROCEDURES);
        this.defaultSchemas = await this.queryOneField(GET_CURRENT_SCHEMAS);
        let oldSchemaNames = Object.keys(this.schemas);
        for (let sc of oldSchemaNames) {
            if (this[sc] === this.schemas[sc])
                delete this[sc];
        }
        this.schemas = {};
        for (let r of schemasAndTables) {
            let schema = this.schemas[r.schema] = this.schemas[r.schema] || new PgSchema(this, r.schema);
            if (!(r.schema in this))
                this[r.schema] = schema;
            schema.tables[r.name] = new PgTable(schema, r);
            if (!(r.name in schema))
                schema[r.name] = schema.tables[r.name];
        }
        for (let r of functions) {
            let schema = this.schemas[r.schema] = this.schemas[r.schema] || new PgSchema(this, r.schema);
            if (!(r.schema in this))
                this[r.schema] = schema;
            schema.fn[r.name] = pgUtils.createFunctionCaller(schema, r);
        }
        this.setDefaultTablesAndFunctions();
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
    async initFieldTypes() {
        let schemaNames = Object.keys(this.schemas);
        if (!schemaNames.length) {
            this.getLogger(true).error("No readable schema found!");
            return;
        }
        let type2oid = {};
        let res = await this.query(TYPE2OID);
        for (let tt of res || []) {
            type2oid[tt.typname] = +tt.oid;
        }
        let specialTypeFields = await this.query(LIST_SPECIAL_TYPE_FIELDS + ' AND c.nspname = ANY($1)', [schemaNames]);
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
                parser: PgConverters.parseBooleanArray
            },
            {
                oidList: [
                    type2oid['_int2'],
                    type2oid['_int4'],
                    type2oid['_float4'],
                ],
                parser: PgConverters.parseNumberArray
            },
            {
                oidList: [
                    type2oid['_text'],
                    type2oid['_varchar']
                ],
                parser: PgConverters.parseArray
            },
            {
                oidList: [
                    type2oid['_json'],
                    type2oid['_jsonb']
                ],
                parser: PgConverters.parseJsonArray
            },
            {
                oidList: [
                    type2oid['_date'],
                    type2oid['_time'],
                    type2oid['_timetz'],
                    type2oid['_timestamp'],
                    type2oid['_timestamptz'],
                ],
                parser: PgConverters.parseDateArray
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
                    pg.types.setTypeParser(r.typid, PgConverters.parseArray);
                    delete this.pgdbTypeParsers[r.typid];
            }
        }
        this.pgdbTypeParsers[type2oid['int8']] = PgConverters.parseNumberWithValidation;
        this.pgdbTypeParsers[type2oid['float8']] = PgConverters.parseNumberWithValidation;
        this.pgdbTypeParsers[type2oid['_int8']] = PgConverters.parseNumberArrayWithValidation;
        this.pgdbTypeParsers[type2oid['_float8']] = PgConverters.parseNumberArrayWithValidation;
        this.knownOids[type2oid['int8']] = true;
        this.knownOids[type2oid['float8']] = true;
        this.knownOids[type2oid['_int8']] = true;
        this.knownOids[type2oid['_float8']] = true;
        let allUsedTypeFields = await this.queryOneColumn(`
            SELECT distinct a.atttypid as typid
            FROM pg_attribute a
                JOIN pg_class b ON (a.attrelid = b.oid)
                JOIN pg_type t ON (a.atttypid = t.oid)
                JOIN pg_namespace c ON (b.relnamespace=c.oid)
            WHERE
                reltype>0 AND
                c.nspname = ANY($1)`, [schemaNames]);
        allUsedTypeFields.forEach(oid => this.knownOids[oid] = true);
    }
    async setTypeParser(typeName, parser, schemaName) {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                pg.types.setTypeParser(oid, parser);
                delete this.pgdbTypeParsers[oid];
                this.knownOids[oid] = true;
            }
            else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
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
    }
    async setPgDbTypeParser(typeName, parser, schemaName) {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                this.pgdbTypeParsers[oid] = parser;
                this.knownOids[oid] = true;
            }
            else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                list.forEach(oid => {
                    this.pgdbTypeParsers[oid] = parser;
                    this.knownOids[oid] = true;
                });
            }
        }
        catch (e) {
            throw new Error('Not existing type: ' + typeName);
        }
    }
    async resetMissingParsers(connection, oidList) {
        let unknownOids = _.uniq(oidList.filter(oid => !this.knownOids[oid]));
        if (unknownOids.length) {
            let fieldsData = await connection.query(`select oid, typcategory from pg_type where oid = ANY($1)`, [unknownOids]);
            fieldsData.rows.forEach(fieldData => {
                if (fieldData.typcategory == 'A') {
                    this.pgdbTypeParsers[fieldData.oid] = PgConverters.parseArray;
                }
                this.knownOids[fieldData.oid] = true;
            });
        }
    }
    async dedicatedConnectionBegin() {
        if (this.needToFixConnectionForListen()) {
            await this.runRestartConnectionForListen();
        }
        let pgDb = new PgDb(this);
        pgDb.connection = await this.pool.connect();
        pgDb.connection.on('error', QueryAble.connectionErrorListener);
        return pgDb;
    }
    async dedicatedConnectionEnd() {
        if (this.connection) {
            this.connection.off('error', QueryAble.connectionErrorListener);
            try {
                await this.connection.release();
            }
            catch (err) {
                this.getLogger().error('Error while dedicated connection end.', err);
            }
            this.connection = null;
        }
        return this;
    }
    async savePoint(name) {
        if (this.isTransactionActive()) {
            name = (name || '').replace(/"/g, '');
            await this.query(`SAVEPOINT "${name}"`);
        }
        else {
            throw new Error('No active transaction');
        }
        return this;
    }
    async savePointRelease(name) {
        if (this.isTransactionActive()) {
            name = (name || '').replace(/"/g, '');
            await this.query(`RELEASE SAVEPOINT "${name}"`);
        }
        else {
            throw new Error('No active transaction');
        }
        return this;
    }
    async transactionBegin(options) {
        let pgDb = this.connection ? this : await this.dedicatedConnectionBegin();
        let q = 'BEGIN';
        if (options?.isolationLevel) {
            q += ' ISOLATION LEVEL ' + options.isolationLevel;
        }
        if (options?.readOnly) {
            q += ' READ ONLY';
        }
        if (options?.deferrable) {
            q += ' DEFERRABLE ';
        }
        await pgDb.query(q);
        return pgDb;
    }
    async transactionCommit() {
        await this.query('COMMIT');
        return this.dedicatedConnectionEnd();
    }
    async transactionRollback(options) {
        if (options?.savePoint) {
            let name = (options.savePoint || '').replace(/"/g, '');
            await this.query(`ROLLBACK TO SAVEPOINT "${name}"`);
            return this;
        }
        else {
            await this.query('ROLLBACK');
            return this.dedicatedConnectionEnd();
        }
    }
    isTransactionActive() {
        return this.connection != null;
    }
    async execute(fileName, statementTransformerFunction) {
        let isTransactionInPlace = this.isTransactionActive();
        let pgdb = isTransactionInPlace ? this : await this.dedicatedConnectionBegin();
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
                                        rl?.resume();
                                    }, reject);
                                    rl?.pause();
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
                rl = null;
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
    }
    listeners = new EventEmitter();
    connectionForListen = null;
    _needToRestartConnectionForListen = false;
    restartConnectionForListen = null;
    async listen(channel, callback) {
        let restartConnectionError = null;
        if (this.needToFixConnectionForListen()) {
            restartConnectionError = await this.runRestartConnectionForListen();
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
                    await this.initConnectionForListen();
                }
                await this.connectionForListen.query(`LISTEN "${channel}"`);
            }
            catch (err) {
                this._needToRestartConnectionForListen = true;
                throw err;
            }
            this.listeners.on(channel, callback);
        }
    }
    async unlisten(channel, callback) {
        let restartConnectionError = null;
        if (this.needToFixConnectionForListen()) {
            restartConnectionError = await this.runRestartConnectionForListen();
        }
        if (callback && this.listeners.listenerCount(channel) > 1) {
            this.listeners.removeListener(channel, callback);
        }
        else {
            if (restartConnectionError) {
                throw restartConnectionError;
            }
            try {
                await this.internalQuery({ connection: this.connectionForListen, sql: `UNLISTEN "${channel}"` });
                if (this.connectionForListen && this.listeners.eventNames().length == 1) {
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
    }
    async notify(channel, payload) {
        if (this.needToFixConnectionForListen()) {
            let restartConnectionError = await this.runRestartConnectionForListen();
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
    }
    async runRestartConnectionForListen() {
        if (!this._needToRestartConnectionForListen) {
            return null;
        }
        let errorResult = null;
        if (!this.restartConnectionForListen) {
            this.restartConnectionForListen = (async () => {
                let eventNames = this.listeners.eventNames();
                if (this.connectionForListen) {
                    try {
                        this.connectionForListen.on('notification', this.notificationListener);
                        this.connectionForListen.on('error', this.errorListener);
                    }
                    catch (e) { }
                    try {
                        await this.connectionForListen.release();
                    }
                    catch (e) { }
                    this.connectionForListen = null;
                }
                let error = null;
                if (eventNames.length) {
                    try {
                        await this.initConnectionForListen();
                        for (let channel of eventNames) {
                            await this.connectionForListen.query(`LISTEN "${channel}"`);
                        }
                    }
                    catch (err) {
                        error = err;
                    }
                }
                return error;
            })();
            errorResult = await this.restartConnectionForListen;
            this.restartConnectionForListen = null;
        }
        else {
            errorResult = await this.restartConnectionForListen;
        }
        if (!errorResult) {
            this._needToRestartConnectionForListen = false;
        }
        return errorResult;
    }
    needToFixConnectionForListen() {
        return this._needToRestartConnectionForListen;
    }
    async tryToFixConnectionForListenActively() {
        await new Promise(r => setTimeout(r, 1000));
        let error = await this.runRestartConnectionForListen();
        if (error) {
            await this.tryToFixConnectionForListenActively();
        }
    }
    notificationListener = (notification) => this.listeners.emit(notification.channel, notification);
    errorListener = (e) => {
        this._needToRestartConnectionForListen = true;
        this.tryToFixConnectionForListenActively();
    };
    async initConnectionForListen() {
        this.connectionForListen = await this.pool.connect();
        this.connectionForListen.on('notification', this.notificationListener);
        this.connectionForListen.on('error', this.errorListener);
    }
}
export default PgDb;
//# sourceMappingURL=pgDb.js.map