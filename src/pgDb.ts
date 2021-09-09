import { QueryAble, ResultFieldType } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
import * as PgConverters from "./pgConverters";
import { pgUtils } from "./pgUtils";
import * as _ from 'lodash';
import * as pg from 'pg';
import * as readline from 'readline';
import * as fs from 'fs';
import { PgDbLogger } from './pgDbLogger';
import { ConnectionOptions } from './connectionOptions';
import * as EventEmitter from 'events';

const CONNECTION_URL_REGEXP = /^postgres:\/\/(?:([^:]+)(?::([^@]*))?@)?([^\/:]+)?(?::([^\/]+))?\/(.*)$/;
const SQL_TOKENIZER_REGEXP = /''|'|""|"|;|\$|--|\/\*|\*\/|(.+?)/g;
const SQL_$_ESCAPE_REGEXP = /\$[^$]*\$/g;

/** looks like we only get back those that we have access to */
const LIST_SCHEMAS_TABLES =
    `SELECT table_schema as schema, table_name as name 
     FROM information_schema.tables 
     WHERE table_schema NOT IN ('pg_catalog', 'pg_constraint', 'information_schema')`;
const GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA = "SELECT t.oid FROM pg_catalog.pg_type t, pg_namespace n WHERE typname=:typeName and n.oid=t.typnamespace and n.nspname=:schemaName;";
const GET_OID_FOR_COLUMN_TYPE = "SELECT t.oid FROM pg_catalog.pg_type t WHERE typname=:typeName";

/** looks like we only get back those that we have access to */
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
//const LIST_ARRAY_TYPE_FIELDS = 'SELECT a.atttypid as oid FROM pg_attribute a WHERE a.attndims>0 AND a.atttypid>200000';
//const LIST_ARRAY_TYPE_FIELDS = 'SELECT a.atttypid as type_oid FROM pg_attribute a WHERE a.tttypid in (1005,1007,1016,1021,1022) OR (a.attndims>0 AND a.atttypid>200000)';

/*
 SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as type_oid, format_type(a.atttypid, a.atttypmod)
 FROM pg_attribute a
 JOIN pg_class b ON (a.attrelid = b.relfilenode)
 JOIN pg_namespace c ON (b.relnamespace=c.oid)
 WHERE a.attndims>0 AND a.atttypid>200000;
 */

/*
 SELECT * FROM pg_catalog.pg_type t where t.typname like '%tz';
 SELECT t.oid FROM pg_catalog.pg_type t WHERE t.typname in ('timestamptz', 'timetz');

 reltype -> only include the table columns (this is zero for indexes)
 a.attndims>0  -> not reliable (truncate/create table like.. not set it correctly)
 */
/** We get back fields as well that we don't have access to, thus we need to filter those schemas that we have permission for
 * ... TODO check it for tables */
const LIST_SPECIAL_TYPE_FIELDS =
    `SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as typid 
    FROM pg_attribute a 
    JOIN pg_class b ON (a.attrelid = b.oid)
    JOIN pg_type t ON (a.atttypid = t.oid)
    JOIN pg_namespace c ON (b.relnamespace=c.oid) 
    WHERE (a.atttypid in (114, 3802, 1082, 1083, 1114, 1184, 1266, 3614) or t.typcategory='A')
    AND reltype>0 `;
//AND c.nspname not in ('pg_catalog', 'pg_constraint', 'information_schema')

export enum FieldType { JSON, ARRAY, TIME, TSVECTOR }

export enum TranzactionIsolationLevel {
    serializable = 'SERIALIZABLE',
    repeatableRead = 'REPEATABLE READ',
    readCommitted = 'READ COMMITTED',
    readUncommitted = 'READ UNCOMMITTED'
}

export type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;

/** LISTEN callback parameter */
export interface Notification {
    processId: number,
    channel: string,
    payload?: string
}

export class PgDb extends QueryAble {
    protected static instances: { [index: string]: Promise<PgDb> };
    /*protected*/
    pool;
    connection;

    /*protected*/
    config: ConnectionOptions;
    /*protected*/
    defaultSchemas; // for this.tables and this.fn

    db;
    schemas: { [name: string]: PgSchema };
    tables: { [name: string]: PgTable<any> } = {};
    fn: { [name: string]: (...any) => any } = {};
    [name: string]: any | PgSchema;
    /* protected */
    pgdbTypeParsers = {};
    /* protected */
    knownOids: Record<number, boolean> = {};
    /* protected */
    postProcessResult: PostProcessResultFunc;

    private constructor(pgdb: { defaultSchemas?, config?, schemas?, pool?, pgdbTypeParsers?, knownOids?, getLogger?: () => any, postProcessResult?: PostProcessResultFunc } = {}) {
        super();
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

        this.defaultSchemas = pgdb.defaultSchemas;
        this.setDefaultTablesAndFunctions();
    }

    setPostProcessResult(f: (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void) {
        this.postProcessResult = f;
    }

    /** If planned to used as a static singleton */
    static async getInstance(config: ConnectionOptions): Promise<PgDb> {
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
        let connectionString = `postgres://${config.user}@${config.host}:${config.port}/${config.database}`; // without password!
        if (!PgDb.instances) {
            PgDb.instances = {};
        }
        if (PgDb.instances[connectionString]) {
            return PgDb.instances[connectionString];
        } else {
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
        await this.pool.end((err: Error) => { });
    }

    static async connect(config: ConnectionOptions): Promise<PgDb> {
        if (config.connectionString) {
            let res = CONNECTION_URL_REGEXP.exec(config.connectionString);
            if (res) {
                config.user = res[1];
                if (res[2]) config.password = res[2];
                config.host = res[3] ? res[3] : 'localhost';
                config.port = res[4] ? +res[4] : 5432;
                config.database = res[5];
            }
        }
        let pgdb = new PgDb({ config: config });
        return pgdb.init();
    }

    private async init(): Promise<PgDb> {
        this.pool = new pg.Pool(_.omit(this.config, ['logger', 'skipUndefined']));
        if (this.config.logger)
            this.setLogger(this.config.logger);

        this.pool.on('error', (e, client) => {
            // if a client is idle in the pool
            // and receives an error - for example when your PostgreSQL server restarts
            // the pool will catch the error & let you handle it here
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

    private async initSchemasAndTables() {
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

        // this.getLogger(true).log('defaultSchemas: ' + defaultSchemas);
        this.setDefaultTablesAndFunctions();
    }

    private setDefaultTablesAndFunctions() {
        this.tables = {};
        this.fn = {};

        if (!this.defaultSchemas) return;
        for (let sc of this.defaultSchemas) {
            let schema = this.schemas[sc];
            // this.getLogger(true).log('copy schame to default', sc, schema && Object.keys(schema.tables), schema && Object.keys(schema.fn));
            if (!schema)
                continue;
            for (let table in schema.tables)
                this.tables[table] = this.tables[table] || schema.tables[table];
            for (let fn in schema.fn)
                this.fn[fn] = this.fn[fn] || schema.fn[fn];
        }
    }

    private async initFieldTypes() {
        //--- init field types -------------------------------------------
        let schemaNames = "'" + Object.keys(this.schemas).join("', '") + "'";
        if (schemaNames == "''") {
            this.getLogger(true).error("No readable schema found!");
            return;
        }
        let specialTypeFields: { schema_name: string, table_name: string, column_name: string, typid: number }[]
            = await this.query(LIST_SPECIAL_TYPE_FIELDS + ' AND c.nspname in (' + schemaNames + ')');

        for (let r of specialTypeFields) {
            if (this.schemas[r.schema_name][r.table_name]) {
                this.schemas[r.schema_name][r.table_name].fieldTypes[r.column_name] =
                    ([3802, 114].indexOf(r.typid) > -1) ? FieldType.JSON :
                        ([3614].indexOf(r.typid) > -1) ? FieldType.TSVECTOR :
                            ([1082, 1083, 1114, 1184, 1266].indexOf(r.typid) > -1) ? FieldType.TIME :
                                FieldType.ARRAY;
            }
        }

        // https://web.archive.org/web/20160613215445/https://doxygen.postgresql.org/include_2catalog_2pg__type_8h_source.html
        // https://github.com/lib/pq/blob/master/oid/types.go

        let builtInArrayTypeParsers: { oidList: number[], parser: (string) => any }[] = [
            {
                oidList: [
                    1000 // bool[]
                ],
                parser: PgConverters.arraySplitToBool
            },
            {
                oidList: [
                    1005, // smallInt[] int2[] 
                    1007, // integer[]  int4[]
                    1021  // real[] float4[]
                ],
                parser: PgConverters.arraySplitToNum
            },
            {
                oidList: [
                    1009, // text[]
                    1015  // varchar[]
                ],
                parser: PgConverters.arraySplit
            },
            {
                oidList: [
                    199, // json[]
                    3807 // jsonb[]
                ],
                parser: PgConverters.arraySplitToJson
            },
            {
                oidList: [
                    1115, // timestamp[]
                    1182, // date[]
                    1183, // time[]
                    1185, // timestamptz[]
                    1270  // timetz[]
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
                case 114:  // json
                case 3802: // jsonb
                case 1082: // date
                case 1083: // time
                case 1114: // timestamp
                case 1184: // timestamptz
                case 1266: // timetz
                case 3614: // tsvector
                    break;
                case 1016: // bigInt[] int8[]
                case 1022: // double[] float8[]
                    //pg.types.setTypeParser(r.typid, arraySplitToNumWithValidation);
                    //delete this.pgdbTypeParsers[r.typid];
                    break;
                default:
                    //best guess otherwise user need to specify
                    pg.types.setTypeParser(r.typid, PgConverters.arraySplit);
                    delete this.pgdbTypeParsers[r.typid];
            }
        }

        //has to set outside of pgjs as it doesnt support exceptions (stop everything immediately)
        await this.setPgDbTypeParser('int8', PgConverters.numWithValidation); //int8 - 20
        await this.setPgDbTypeParser('float8', PgConverters.numWithValidation); //float8 - 701
        await this.setPgDbTypeParser('_int8', PgConverters.stringArrayToNumWithValidation);
        await this.setPgDbTypeParser('_float8', PgConverters.stringArrayToNumWithValidation);

        let allUsedTypeFields = await this.queryOneColumn(`
            SELECT a.atttypid as typid
            FROM pg_attribute a
                JOIN pg_class b ON (a.attrelid = b.oid)
                JOIN pg_type t ON (a.atttypid = t.oid)
                JOIN pg_namespace c ON (b.relnamespace=c.oid)
            WHERE
                reltype>0 AND
                c.nspname in (${schemaNames})`
        );
        allUsedTypeFields.forEach(oid => this.knownOids[oid] = true);
    }

    /**
     * if schemaName is null, it will be applied for all schemas
     */
    async setTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void> {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                pg.types.setTypeParser(oid, parser);
                delete this.pgdbTypeParsers[oid];
                this.knownOids[oid] = true;
            } else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                list.forEach(oid => {
                    pg.types.setTypeParser(oid, parser);
                    delete this.pgdbTypeParsers[oid];
                    this.knownOids[oid] = true;
                });
            }
        } catch (e) {
            throw Error('Not existing type: ' + typeName);
        }
    }

    async setPgDbTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void> {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                this.pgdbTypeParsers[oid] = parser;
                this.knownOids[oid] = true;
            } else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                list.forEach(oid => {
                    this.pgdbTypeParsers[oid] = parser;
                    this.knownOids[oid] = true;
                });
            }
        } catch (e) {
            throw Error('Not existing type: ' + typeName);
        }
    }

    async resetMissingParsers(connection, oidList: number[]): Promise<void> {
        let unknownOids = oidList.filter(oid => !this.knownOids[oid]);
        if (unknownOids.length) {
            let fieldsData = await connection.query(
                `select oid, typcategory from pg_type where oid = ANY($1)`,
                [unknownOids]
            );

            fieldsData.rows.forEach(fieldData => {
                if (fieldData.typcategory == 'A') {
                    this.pgdbTypeParsers[fieldData.oid] = PgConverters.arraySplit;
                }
                this.knownOids[fieldData.oid] = true;
            });
        }
    }

    async dedicatedConnectionBegin(): Promise<PgDb> {
        if (this.needToFixConnectionForListen()) {
            await this.runRestartConnectionForListen();
        }
        let pgDb = new PgDb(this);
        pgDb.connection = await this.pool.connect();
        pgDb.connection.on('error', () => { });
        return pgDb;
    }

    async dedicatedConnectionEnd(): Promise<PgDb> {
        if (this.connection) {
            try {
                await this.connection.release();
            } catch (err) {
                this.getLogger().error('Error while dedicated connection end.', err);
            }
            this.connection = null;
        }
        return this;
    }

    /** 
     * transaction save point
     * https://www.postgresql.org/docs/current/sql-savepoint.html 
     */
    async savePoint(name: string): Promise<PgDb> {
        if (this.isTransactionActive()) {
            name = (name || '').replace(/"/g, '');
            await this.query(`SAVEPOINT "${name}"`);
        } else {
            throw Error('No active transaction');
        }
        return this;
    }

    /** 
     * "RELEASE SAVEPOINT" - remove transaction save point
     * https://www.postgresql.org/docs/current/sql-savepoint.html 
     */
    async savePointRelease(name: string): Promise<PgDb> {
        if (this.isTransactionActive()) {
            name = (name || '').replace(/"/g, '');
            await this.query(`RELEASE SAVEPOINT "${name}"`);
        } else {
            throw Error('No active transaction');
        }
        return this;
    }

    async transactionBegin(options?: { isolationLevel?: TranzactionIsolationLevel, deferrable?: boolean, readOnly?: boolean }): Promise<PgDb> {
        let pgDb = this.connection ? this : await this.dedicatedConnectionBegin();
        let q = 'BEGIN'
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

    async transactionCommit(): Promise<PgDb> {
        await this.query('COMMIT');
        return this.dedicatedConnectionEnd();
    }

    async transactionRollback(options?: { savePoint?: string }): Promise<PgDb> {
        if (options?.savePoint) {
            let name = (options.savePoint || '').replace(/"/g, '');
            await this.query(`ROLLBACK TO SAVEPOINT "${name}"`);
            return this;
        } else {
            await this.query('ROLLBACK');
            return this.dedicatedConnectionEnd();
        }
    }

    isTransactionActive(): boolean {
        return this.connection != null;
    }

    async execute(fileName: string, statementTransformerFunction?: (string) => string): Promise<void> {
        let isTransactionInPlace = this.isTransactionActive();
        // statements must be run in a dedicated connection
        let pgdb = isTransactionInPlace ? this : await this.dedicatedConnectionBegin();

        /** run statements one after the other */
        let runStatementList = (statementList) => {
            //this.getLogger(true).log('consumer start', commands.length);
            return new Promise((resolve, reject) => {
                let currentStatement = 0;
                let runStatement = () => {
                    //this.getLogger(true).log('commnads length', commands.length, i);
                    if (statementList.length == currentStatement) {
                        resolve(undefined);
                    } else {
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
        let promise = new Promise<void>((resolve, reject) => {
            let statementList = [];
            let tmp = '', t: RegExpExecArray;
            let consumer;
            let inQuotedString: string;
            let rl = readline.createInterface({
                input: fs.createReadStream(fileName),
                terminal: false
            }).on('line', (line) => {
                lineCounter++;
                try {
                    //console.log('Line: ' + line);
                    while (t = SQL_TOKENIZER_REGEXP.exec(line)) {
                        if (!inQuotedString && (t[0] == '"' || t[0] == "'") || inQuotedString == '"' || inQuotedString == "'") {
                            if (!inQuotedString) {
                                inQuotedString = t[0];
                            } else if (inQuotedString == t[0]) {
                                inQuotedString = null;
                            }
                            tmp += t[0];
                        } else if (!inQuotedString && t[0] == '$' || inQuotedString && inQuotedString[0] == '$') {
                            if (!inQuotedString) {
                                let s = line.slice(SQL_TOKENIZER_REGEXP.lastIndex - 1);
                                let token = s.match(SQL_$_ESCAPE_REGEXP);
                                if (!token) {
                                    throw Error('Invalid sql in line: ' + line);
                                }
                                inQuotedString = token[0];
                                SQL_TOKENIZER_REGEXP.lastIndex += inQuotedString.length - 1;
                                tmp += inQuotedString;
                            } else {
                                tmp += t[0];
                                if (tmp.endsWith(inQuotedString)) {
                                    inQuotedString = null;
                                }
                            }
                        } else if (!inQuotedString && t[0] == '/*' || inQuotedString == '/*') {
                            if (!inQuotedString) {
                                inQuotedString = t[0];
                            } else if (t[0] == '*/') {
                                inQuotedString = null;
                            }
                        } else if (!inQuotedString && t[0] == '--') {
                            line = '';
                        } else if (!inQuotedString && t[0] == ';') {
                            //console.log('push ' + tmp);
                            if (tmp.trim() != '') {
                                statementList.push(tmp);
                                if (!consumer) {
                                    consumer = runStatementList(statementList).then(() => {
                                        // console.log('consumer done');
                                        consumer = null;
                                        statementList.length = 0;
                                        rl.resume();
                                    }, reject);
                                    rl.pause();
                                }
                            }
                            tmp = '';
                        } else {
                            tmp += t[0];
                        }
                    }
                    if (tmp && line) {
                        tmp += '\n';
                    }
                } catch (e) {
                    reject(e);
                }
            }).on('close', () => {
                if (inQuotedString) {
                    reject(Error('Invalid SQL, unterminated string'));
                }

                //if the last statement did't have ';'
                if (tmp.trim() != '') {
                    statementList.push(tmp);
                }
                if (!consumer) {
                    if (statementList.length) {
                        consumer = runStatementList(statementList).catch(reject);
                    } else {
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
                // finally
                //if transaction was in place, don't touch it
                if (!isTransactionInPlace) {
                    return pgdb.dedicatedConnectionEnd();
                }
            }).catch((e) => {
                this.getLogger(true).error(e);
            }).then(() => {
                if (error) {
                    throw error;
                }
                // console.log('connection released');
            });
    }

    private listeners = new EventEmitter();
    private connectionForListen;
    private _needToRestartConnectionForListen = false;
    private restartConnectionForListen: Promise<Error> = null;

    /** 
     * LISTEN to a channel for a NOTIFY (https://www.postgresql.org/docs/current/sql-listen.html)
     * One connection will be dedicated for listening if there are any listeners.
     * When there is no other callback for a channel, LISTEN command is executed
     */
    async listen(channel: string, callback: (notification: Notification) => void) {
        let restartConnectionError: Error = null;
        if (this.needToFixConnectionForListen()) {
            restartConnectionError = await this.runRestartConnectionForListen();
        }
        if (this.listeners.listenerCount(channel)) {
            this.listeners.on(channel, callback);
        } else {
            if (restartConnectionError) {
                throw restartConnectionError;
            }
            try {
                if (!this.connectionForListen) {
                    await this.initConnectionForListen();
                }
                await this.connectionForListen.query(`LISTEN "${channel}"`);
            } catch (err) {
                this._needToRestartConnectionForListen = true;
                throw err;
            }
            this.listeners.on(channel, callback);
        }
    }

    /**
     * Remove a callback which listening on a channel
     * When all callback is removed from a channel UNLISTEN command is executed
     * When all callback is removed from all channel, dedicated connection is released
     */
    async unlisten(channel: string, callback?: (Notification) => void) {
        let restartConnectionError: Error = null;
        if (this.needToFixConnectionForListen()) {
            restartConnectionError = await this.runRestartConnectionForListen();
        }
        if (callback && this.listeners.listenerCount(channel) > 1) {
            this.listeners.removeListener(channel, callback);
        } else {
            if (restartConnectionError) {
                throw restartConnectionError;
            }
            try {
                await this.internalQuery({ connection: this.connectionForListen, sql: `UNLISTEN "${channel}"` });
                if (this.listeners.eventNames().length == 1) {
                    this.connectionForListen.removeAllListeners('notification');
                    this.connectionForListen.release();
                    this.connectionForListen = null;
                }
            } catch (err) {
                this._needToRestartConnectionForListen = true;
                throw err;
            }
            this.listeners.removeAllListeners(channel);
        }
    }

    /**
     * Notify a channel (https://www.postgresql.org/docs/current/sql-notify.html)
     */
    async notify(channel: string, payload?: string) {
        if (this.needToFixConnectionForListen()) {
            let restartConnectionError = await this.runRestartConnectionForListen();
            if (restartConnectionError) {
                throw restartConnectionError;
            }
        }
        let hasConnectionForListen = !!this.connectionForListen;
        let connection = this.connectionForListen || this.connection;
        //let sql = 'NOTIFY ' + channel + ', :payload';
        let sql = 'SELECT pg_notify(:channel, :payload)';
        let params = { channel, payload };
        try {
            return this.internalQuery({ connection, sql, params });
        } catch (err) {
            if (hasConnectionForListen) {
                this._needToRestartConnectionForListen = true;
            }
            throw err;
        }
    }

    async runRestartConnectionForListen(): Promise<Error> {
        let errorResult: Error = null;
        if (!this.restartConnectionForListen) {
            this.restartConnectionForListen = (async () => {
                let eventNames = this.listeners.eventNames();
                try {
                    await this.connectionForListen.release();
                } catch (e) {
                }
                this.connectionForListen = null;
                let error: Error;
                if (eventNames.length) {
                    try {
                        await this.initConnectionForListen();
                        for (let channel of eventNames) {
                            await this.connectionForListen.query(`LISTEN "${channel as string}"`);
                        }
                    } catch (err) {
                        error = err;
                    }
                }
                return error;
            })();
            errorResult = await this.restartConnectionForListen;
            this.restartConnectionForListen = null;
        } else {
            errorResult = await this.restartConnectionForListen;
        }
        if (!errorResult) {
            this._needToRestartConnectionForListen = false;
        }
        return errorResult;
    }

    needToFixConnectionForListen(): boolean {
        return this._needToRestartConnectionForListen;
    }

    private async initConnectionForListen() {
        this.connectionForListen = await this.pool.connect();
        this.connectionForListen.on('notification', (notification: Notification) => this.listeners.emit(notification.channel, notification));
        this.connectionForListen.on('error', (e) => {
            this._needToRestartConnectionForListen = true;
        });
    }
}


export default PgDb;
