import {QueryAble} from "./queryAble";
var pg = require('pg');
var util = require('util');
var readline = require('readline');
var fs = require('fs');
var moment = require('moment');

import {PgTable} from "./pgTable";
import {PgSchema} from "./pgSchema";
import * as PgConverters from "./pgConverters";
import {pgUtils} from "./pgUtils";
const CONNECTION_URL_REGEXP = /^postgres:\/\/(?:([^:]+)(?::([^@]*))?@)?([^\/:]+)?(?::([^\/]+))?\/(.*)$/;
const SQL_TOKENIZER_REGEXP = /''|'|""|"|;|\$|([^;'"$]+)/g;
const SQL_$_ESCAPE_REGEXP = /\$[^$]*\$/g;

const LIST_SCHEMAS_TABLES = "SELECT table_schema as schema, table_name as name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')";
const GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA = "SELECT t.oid FROM pg_catalog.pg_type t, pg_namespace n WHERE typname=:typeName and n.oid=t.typnamespace and n.nspname=:schemaName;";
const GET_OID_FOR_COLUMN_TYPE = "SELECT t.oid FROM pg_catalog.pg_type t WHERE typname=:typeName";
const GET_SCHEMAS_PROCEDURES = `select
    n.nspname as "schema",
    p.proname as "name",
    (not p.proretset) as "return_single_row",
    (t.typtype in ('b', 'd', 'e', 'r')) as "return_single_value"
from pg_proc p
     inner join pg_namespace n on (p.pronamespace = n.oid)
     inner join pg_type t on (p.prorettype = t.oid)
     left outer join pg_trigger tr on (tr.tgfoid = p.oid)
where n.nspname not in ('pg_catalog','information_schema')
  and tr.oid is null;`;
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

 reltoastrelid -> only incude the table columns (no seq/index)
 a.attndims>0  -> not reliable (truncate/create table like.. not set it correctly)
 */
const LIST_SPECIAL_TYPE_FIELDS =
    `SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as typid 
    FROM pg_attribute a 
    JOIN pg_class b ON (a.attrelid = b.oid)
    JOIN pg_type t ON (a.atttypid = t.oid)
    JOIN pg_namespace c ON (b.relnamespace=c.oid) 
    WHERE (a.atttypid in (114, 3802, 1082, 1083, 1114, 1184, 1266, 3614) or t.typcategory='A') 
    AND c.nspname not in ('pg_catalog','pg_constraint') and reltoastrelid>0`;

export enum FieldType {JSON, ARRAY, TIME, TSVECTOR}

/**
 * @property connectionString e.g.: "postgres://user@localhost/database"
 * @property user can be specified through PGHOST env variable
 * @property user can be specified through PGUSER env variable (defaults USER env var)
 * @property database can be specified through PGDATABASE env variable (defaults USER env var)
 * @property password can be specified through PGPASSWORD env variable
 * @property port can be specified through PGPORT env variable
 * @property idleTimeoutMillis how long a client is allowed to remain idle before being closed
 * @property skipUndefined if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
 */
export interface ConnectionOptions {
    host?: string; //host can be specified through PGHOST env variable (defaults USER env var)
    user?: string; //user can be specified through PGUSER env variable (defaults USER env var)
    database?: string; // can be specified through PGDATABASE env variable (defaults USER env var)
    password?: string; // can be specified through PGPASSWORD env variable
    port?: number; // can be specified through PGPORT env variable
    poolSize?: number;
    rows?: number;
    binary?: boolean;
    poolIdleTimeout?: number;
    reapIntervalMillis?: number;
    poolLog?: boolean;
    client_encoding?: string;
    ssl?: boolean| any; //| TlsOptions;
    application_name?: string;
    fallback_application_name?: string;
    parseInputDatesAsUTC?: boolean;
    connectionString?: string;
    idleTimeoutMillis?: number; // how long a client is allowed to remain idle before being closed

    logger?: PgDbLogger;
    skipUndefined?: 'all' | 'select' | 'none'; // if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
}

/**
 * log will get 3 parameters:
 *    sql -> the query
 *    parameters -> parameters for the query
 *    poolId -> the id of the connection
 */
export interface PgDbLogger {
    log: Function;
    error: Function;
}

export class PgDb extends QueryAble {
    protected static instances: {[index: string]: Promise<PgDb>};
    pool;
    connection;
    config: ConnectionOptions;
    db;
    schemas: {[name: string]: PgSchema};
    tables: {[name: string]: PgTable<any>} = {};
    fn: {[name: string]: (...any)=>any} = {};
    [name: string]: any|PgSchema;
    pgdbTypeParsers = {};

    private constructor(pgdb: {config?,schemas?,pool?,pgdbTypeParsers?,getLogger?:()=>any} = {}) {
        super();
        this.schemas = {};
        this.config = pgdb.config;
        this.pool = pgdb.pool;
        this.pgdbTypeParsers = pgdb.pgdbTypeParsers || {};
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
    }

    /** If planned to used as a static singleton */
    static async getInstance(config: ConnectionOptions): Promise<PgDb> {
        if (config.connectionString) {
            var res = CONNECTION_URL_REGEXP.exec(config.connectionString);
            if (res) {
                config.user = res[1];
                config.password = res[2] ? res[2] : '';
                config.host = res[3] ? res[3] : 'localhost';
                config.port = res[4] ? +res[4] : 5432;
                config.database = res[5];
            }
        }
        var connectionString = `postgres://${config.user}@${config.host}:${config.port}/${config.database}`; // without password!
        if (!PgDb.instances) {
            PgDb.instances = {};
        }
        if (PgDb.instances[connectionString]) {
            return PgDb.instances[connectionString];
        } else {
            var pgdb = new PgDb({config: config});
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
        await this.pool.end();
    }

    static async connect(config: ConnectionOptions): Promise<PgDb> {
        if (config.connectionString) {
            var res = CONNECTION_URL_REGEXP.exec(config.connectionString);
            if (res) {
                config.user = res[1];
                if (res[2]) config.password = res[2];
                config.host = res[3] ? res[3] : 'localhost';
                config.port = res[4] ? +res[4] : 5432;
                config.database = res[5];
            }
        }
        var pgdb = new PgDb({config: config});
        return pgdb.init();
    }

    private async init(): Promise<PgDb> {
        this.pool = new pg.Pool(Object.create(this.config, {logger: {value: undefined}, skipUndefined: {value: undefined}}));
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
        let schemasAndTables = await this.pool.query(LIST_SCHEMAS_TABLES);
        let functions = await this.pool.query(GET_SCHEMAS_PROCEDURES);
        let defaultSchemas = PgConverters.arraySplit(await this.queryOneField(GET_CURRENT_SCHEMAS));
        let oldSchemaNames = Object.keys(this.schemas);
        for (let sc of oldSchemaNames) {
            if (this[sc] === this.schemas[sc])
                delete this[sc];
        }
        this.schemas = {};
        for (let r of schemasAndTables.rows) {
            let schema = this.schemas[r.schema] = this.schemas[r.schema] || new PgSchema(this, r.schema);
            if (!(r.schema in this))
                this[r.schema] = schema;
            schema.tables[r.name] = new PgTable(schema, r);
            if (!(r.name in schema))
                schema[r.name] = schema.tables[r.name];
        }

        for (let r of functions.rows) {
            let schema = this.schemas[r.schema] = this.schemas[r.schema] || new PgSchema(this, r.schema);
            if (!(r.schema in this))
                this[r.schema] = schema;
            schema.fn[r.name] = pgUtils.createFunctionCaller(schema, r);
        }

        // this.getLogger(true).log('defaultSchemas: ' + defaultSchemas);
        this.tables = {};
        this.fn = {};
        for (let sc of defaultSchemas) {
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
        let specialTypeFields: {rows: {schema_name: string,table_name: string,column_name: string,typid: number}[]}
            = await this.pool.query(LIST_SPECIAL_TYPE_FIELDS);

        for (let r of specialTypeFields.rows) {
            this.schemas[r.schema_name][r.table_name].fieldTypes[r.column_name] =
                ([3802, 114].indexOf(r.typid) > -1) ? FieldType.JSON :
                    ([3614].indexOf(r.typid) > -1) ? FieldType.TSVECTOR :
                    ([1082, 1083, 1114, 1184, 1266].indexOf(r.typid) > -1) ? FieldType.TIME :
                        FieldType.ARRAY;
        }

        for (let r of specialTypeFields.rows) {
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
                case 1005: // smallInt[] int2[]
                case 1007: // integer[]  int4[]
                case 1021: // real[] float4[]
                    pg.types.setTypeParser(r.typid, PgConverters.arraySplitToNum);
                    break;
                case 1016: // bigInt[] int8[]
                case 1022: // double[] float8[]
                    //pg.types.setTypeParser(r.typid, arraySplitToNumWithValidation);
                    break;
                case 1115: // timestamp[]
                case 1182: // date[]
                case 1183: // time[]
                case 1185: // timestamptz[]
                case 1270: // timetz[]
                    pg.types.setTypeParser(r.typid, PgConverters.arraySplitToDate);
                    break;
                default :
                    //best guess otherwise user need to specify
                    pg.types.setTypeParser(r.typid, PgConverters.arraySplit);
            }
        }

        //has to set outside of pgjs as it doesnt support exceptions (stop everything immediately)
        await this.setPgDbTypeParser('int8', PgConverters.numWithValidation); //int8 - 20
        await this.setPgDbTypeParser('float8', PgConverters.numWithValidation); //float8 - 701
        await this.setPgDbTypeParser('_int8', PgConverters.stringArrayToNumWithValidation);
        await this.setPgDbTypeParser('_float8', PgConverters.stringArrayToNumWithValidation);
    }

    /**
     * if schemaName is null, it will be applied for all schemas
     */
    async setTypeParser(typeName: string, parser: (string)=>any, schemaName?: string): Promise<void> {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, {typeName, schemaName});
                pg.types.setTypeParser(oid, parser);
                delete this.pgdbTypeParsers[oid];
            } else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, {typeName});
                list.forEach(oid => {
                    pg.types.setTypeParser(oid, parser);
                    delete this.pgdbTypeParsers[oid];
                });
            }
        } catch (e) {
            throw Error('Not existing type: ' + typeName);
        }
    }

    async setPgDbTypeParser(typeName: string, parser: (string)=>any, schemaName?: string): Promise<void> {
        try {
            if (schemaName) {
                let oid = await this.queryOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, {typeName, schemaName});
                this.pgdbTypeParsers[oid] = parser;
            } else {
                let list = await this.queryOneColumn(GET_OID_FOR_COLUMN_TYPE, {typeName});
                list.forEach(oid => this.pgdbTypeParsers[oid] = parser);
            }
        } catch (e) {
            throw Error('Not existing type: ' + typeName);
        }
    }

    async dedicatedConnectionBegin(): Promise<PgDb> {
        if (this.connection) {
            return this;
        } else {
            let pgDb = new PgDb(this);
            pgDb.connection = await this.pool.connect();
            return pgDb;
        }
    }

    async dedicatedConnectionEnd(): Promise<PgDb> {
        if (this.connection) {
            await this.connection.release();
            this.connection = null;
        }
        return this;
    }

    async transactionBegin(): Promise<PgDb> {
        let pgDb = await this.dedicatedConnectionBegin();
        await pgDb.query('BEGIN');
        return pgDb;
    }

    async transactionCommit(): Promise<PgDb> {
        await this.query('COMMIT');
        return this.dedicatedConnectionEnd();
    }

    async transactionRollback(): Promise<PgDb> {
        await this.query('ROLLBACK');
        return this.dedicatedConnectionEnd();
    }

    isTransactionActive(): boolean {
        return this.connection != null;
    }

    async execute(fileName, statementTransformerFunction?: (string)=>string): Promise<void> {
        let isTransactionInPlace = this.isTransactionActive();
        let pgdb = await this.dedicatedConnectionBegin();

        /** run statements one after the other */
        let runStatementList = (statementList) => {
            //this.getLogger(true).log('consumer start', commands.length);
            return new Promise((resolve, reject)=> {
                let currentStatement = 0;
                let runStatement = ()=> {
                    //this.getLogger(true).log('commnads length', commands.length, i);
                    if (statementList.length == currentStatement) {
                        resolve();
                    } else {
                        let statement = statementList[currentStatement++];
                        if (statementTransformerFunction) {
                            statement = statementTransformerFunction(statement);
                        }
                        this.getLogger(true).log('run', statementList[currentStatement-1]);
                        pgdb.query(statement)
                            .then(()=>runStatement(), reject)
                            .catch(reject);
                    }
                };
                runStatement();
            }).catch((e)=> {
                this.getLogger(true).error(e);
                throw e;
            });
        };

        let lineCounter = 0;
        var promise = new Promise<void>((resolve, reject)=> {
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
                    //console.log('Line: ' + line);
                    line = line.replace(/--.*$/, '');   // remove comments
                    while (m = SQL_TOKENIZER_REGEXP.exec(line)) {
                        if (m[0] == '"' || m[0] == "'") {
                            if (!inQuotedString) {
                                inQuotedString = m[0];
                            } else if (inQuotedString == m[0]) {
                                inQuotedString = null;
                            }
                            tmp += m[0];
                        } else if (m[0] == '$' && (!inQuotedString || inQuotedString[0] == '$')) {
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
                                tmp += m[0];
                                if (tmp.endsWith(inQuotedString)) {
                                    inQuotedString = null;
                                }
                            }
                        } else if (!inQuotedString && m[0] == ';') {
                            //console.log('push ' + tmp);
                            statementList.push(tmp);
                            if (!consumer) {
                                consumer = runStatementList(statementList).then(()=> {
                                    // console.log('consumer done');
                                    consumer = null;
                                    statementList.length = 0;
                                    rl.resume();
                                }, reject);
                                rl.pause();
                            }
                            tmp = '';
                        } else {
                            tmp += m[0];
                        }
                    }
                    if (tmp && line) {
                        tmp += '\n';
                    }
                } catch (e) {
                    reject(e);
                }
            }).on('close', ()=> {
                if (inQuotedString){
                    reject(Error('Invalid SQL, unterminated string'));
                }

                //if the last statement did't have ';'
                if (tmp.length) {
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
        var error;
        return promise
            .catch((e)=> {
                error = e;
                this.getLogger(true).error('Error at line ' + lineCounter + ' in ' + fileName + '. ' + e);
            })
            .then(()=> {
                // finally
                //if transaction was in place, don't touch it
                isTransactionInPlace ? pgdb : pgdb.dedicatedConnectionEnd();
            }).catch((e)=> {
                this.getLogger(true).error(e);
            }).then(()=>{
                if (error) {
                    throw error;
                }
                // console.log('connection released');
            });
    }
}


export default PgDb;
