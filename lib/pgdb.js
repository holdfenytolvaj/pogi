"use strict";

var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator.throw(value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : new P(function (resolve) {
                resolve(result.value);
            }).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const queryAble_1 = require("./queryAble");
var pg = require('pg');
var util = require('util');
var readline = require('readline');
var fs = require('fs');
var moment = require('moment');
// var pgEscape = require('pg-escape'); FIXME check
// typed-pg FIXME check
const pgTable_1 = require("./pgTable");
const pgSchema_1 = require("./pgSchema");
const CONNECTION_URL_REGEXP = /^postgres:\/\/(?:([^:]+)(?::([^@]*))?@)?([^\/:]+)?(?::([^\/]+))?\/(.*)$/;
const SQL_PARSER_REGEXP = /''|'|""|"|;|\$[^$]*\$|([^;'"$]+)/g;
const LIST_SCHEMAS_TABLES = "SELECT table_schema as schema, table_name as name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')";
const GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA = "SELECT t.oid FROM pg_catalog.pg_type t, pg_namespace n WHERE typname=:typeName and n.oid=t.typnamespace and n.nspname=:schemaName;";
const GET_OID_FOR_COLUMN_TYPE = "SELECT t.oid FROM pg_catalog.pg_type t WHERE typname=:typeName";
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
const LIST_SPECIAL_TYPE_FIELDS = `SELECT c.nspname as schema_name, b.relname as table_name, a.attname as column_name, a.atttypid as typid 
    FROM pg_attribute a 
    JOIN pg_class b ON (a.attrelid = b.oid)
    JOIN pg_type t ON (a.atttypid = t.oid)
    JOIN pg_namespace c ON (b.relnamespace=c.oid) 
    WHERE (a.atttypid in (114, 3802, 1082, 1083, 1114, 1184, 1266) or t.typcategory='A') and c.nspname not in ('pg_catalog','pg_constraint') and reltoastrelid>0;`;
(function (FieldType) {
    FieldType[FieldType["JSON"] = 0] = "JSON";
    FieldType[FieldType["ARRAY"] = 1] = "ARRAY";
    FieldType[FieldType["TIME"] = 2] = "TIME";
})(exports.FieldType || (exports.FieldType = {}));
var FieldType = exports.FieldType;
class PgDb extends queryAble_1.QueryAble {
    constructor() {
        let pgdb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        super();
        this.customTypeOverrides = {};
        this.schemas = {};
        this.config = pgdb.config;
        this.pool = pgdb.pool;
        this.db = this;
        this.defaultLogger = { log: () => {}, error: () => {} };
        for (let schemaName in pgdb.schemas) {
            let schema = new pgSchema_1.PgSchema(this, schemaName);
            this.schemas[schemaName] = schema;
            for (let tableName in pgdb.schemas[schemaName]) {
                if (pgdb.schemas[schemaName][tableName] instanceof pgTable_1.PgTable) {
                    schema[tableName] = new pgTable_1.PgTable(schema, pgdb.schemas[schemaName][tableName].desc, pgdb.schemas[schemaName][tableName].fieldType);
                }
            }
        }
    }
    /** If planned to used as a static singleton */
    static getInstance(config) {
        return __awaiter(this, void 0, void 0, function* () {
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
            var connectionString = config.password ? util.format('postgres://%s:%s@%s:%s/%s', config.user, config.password, config.host, config.port, config.database) : util.format('postgres://%s@%s:%s/%s', config.user, config.host, config.port, config.database);
            if (!PgDb.instances) {
                PgDb.instances = {};
            }
            if (PgDb.instances[connectionString]) {
                return PgDb.instances[connectionString];
            } else {
                var pgdb = new PgDb({ config: config });
                PgDb.instances[connectionString] = pgdb.init();
                return PgDb.instances[connectionString];
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
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
        return __awaiter(this, void 0, void 0, function* () {
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
            var pgdb = new PgDb({ config: config });
            return pgdb.init();
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.pool = new pg.Pool(Object.create(this.config, { logger: { value: undefined } }));
            this.setLogger(this.config.logger);
            this.pool.on('error', (e, client) => {
                // if a client is idle in the pool
                // and receives an error - for example when your PostgreSQL server restarts
                // the pool will catch the error & let you handle it here
                this.getLogger(true).error('pool error', e);
            });
            yield this.reload();
            this.getLogger(true).log('Successfully connected to Db');
            return this;
        });
    }
    reload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initSchemasAndTables();
            yield this.initFieldTypes();
        });
    }
    initSchemasAndTables() {
        return __awaiter(this, void 0, void 0, function* () {
            let schemas_and_tables = yield this.pool.query(LIST_SCHEMAS_TABLES);
            this.schemas = {};
            for (let r of schemas_and_tables.rows) {
                this.schemas[r.schema] = this.schemas[r.schema] || new pgSchema_1.PgSchema(this, r.schema);
                this.schemas[r.schema][r.name] = new pgTable_1.PgTable(this.schemas[r.schema], r);
            }
        });
    }
    initFieldTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            //--- init field types -------------------------------------------
            let specialTypeFields = yield this.pool.query(LIST_SPECIAL_TYPE_FIELDS);
            for (let r of specialTypeFields.rows) {
                this.schemas[r.schema_name][r.table_name].fieldType[r.column_name] = [3802, 114].indexOf(r.typid) > -1 ? FieldType.JSON : [1082, 1083, 1114, 1184, 1266].indexOf(r.typid) > -1 ? FieldType.TIME : FieldType.ARRAY;
            }
            //--- add parsing for array types --------------------------------
            var arraySplit = str => {
                if (str == "{}") return [];
                str = str.substring(1, str.length - 1); //cut off {}
                let e = /"((?:[^"]|\\")*)"(?:,|$)|([^,]*)(?:,|$)/g; //has to be mutable because of exec
                let valList = [];
                let parsingResult;
                do {
                    parsingResult = e.exec(str);
                    let valStr = parsingResult[1] == 'NULL' || parsingResult[2] == 'NULL' ? null : parsingResult[1] == '' || parsingResult[2] == '' ? '' : parsingResult[1] || parsingResult[2];
                    valList.push(valStr ? valStr.replace(/\\"/g, '"') : valStr);
                } while (parsingResult[0].substring(parsingResult[0].length - 1, parsingResult[0].length) == ',');
                return valList;
            };
            var numWithValidation = val => {
                let v = +val;
                if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
                    throw Error("Number can't be represented in javascript precisely: " + val);
                }
                return v;
            };
            var arraySplitToNum = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(Number);
            var arraySplitToNumWithValidation = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(numWithValidation);
            var arraySplitToDate = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(d => moment(d.substring(1, d.length - 1)).toDate());
            for (let r of specialTypeFields.rows) {
                switch (r.typid) {
                    case 114: // json
                    case 3802: // jsonb
                    case 1082: // date
                    case 1083: // time
                    case 1114: // timestamp
                    case 1184: // timestamptz
                    case 1266:
                        break;
                    case 1005: // smallInt[] int2[]
                    case 1007: // integer[]  int4[]
                    case 1021:
                        pg.types.setTypeParser(r.typid, arraySplitToNum);
                        break;
                    case 1016: // bigInt[] int8[]
                    case 1022:
                        pg.types.setTypeParser(r.typid, arraySplitToNumWithValidation);
                        break;
                    case 1115: // timestamp[]
                    case 1182: // date[]
                    case 1183: // time[]
                    case 1185: // timestamptz[]
                    case 1270:
                        pg.types.setTypeParser(r.typid, arraySplitToDate);
                        break;
                    default:
                        //best guess otherwise user need to specify
                        pg.types.setTypeParser(r.typid, arraySplit);
                }
            }
            pg.types.setTypeParser(20, numWithValidation); //int8
            pg.types.setTypeParser(701, numWithValidation); //float8
        });
    }
    /**
     * if schemaName is null, it will be applied for all schemas
     */
    setTypeParser(typeName, parser, schemaName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (schemaName) {
                let oid;
                try {
                    oid = yield this.getOneField(GET_OID_FOR_COLUMN_TYPE_FOR_SCHEMA, { typeName, schemaName });
                } catch (e) {
                    throw Error('Not existing type: ' + typeName);
                }
                this.customTypeOverrides[oid] = true;
                pg.types.setTypeParser(oid, parser);
            } else {
                let list;
                try {
                    list = yield this.getOneColumn(GET_OID_FOR_COLUMN_TYPE, { typeName });
                } catch (e) {
                    throw Error('Not existing type: ' + typeName);
                }
                list.forEach(oid => {
                    this.customTypeOverrides[oid] = true;
                    pg.types.setTypeParser(oid, parser);
                });
            }
        });
    }
    /**
     * @param connectionMode pool|one
     */
    setConnectionMode(connectionMode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (connectionMode == 'one' && !this.connection) {
                this.connection = yield this.pool.connect();
            } else if (connectionMode == 'pool' && this.connection) {
                this.connection.release();
                this.connection = null;
            }
        });
    }
    transactionBegin() {
        return __awaiter(this, void 0, void 0, function* () {
            let pgDb = new PgDb(this);
            yield pgDb.setConnectionMode('one');
            yield pgDb.query('BEGIN');
            return pgDb;
        });
    }
    transactionCommit() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.query('COMMIT');
            yield this.setConnectionMode('pool');
            return this;
        });
    }
    transactionRollback() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.query('ROLLBACK');
            yield this.setConnectionMode('pool');
            return this;
        });
    }
    isTransactionActive() {
        return this.connection != null;
    }
    execute(fileName, transformer) {
        return __awaiter(this, void 0, void 0, function* () {
            var consume = commands => {
                commands = commands.slice();
                //this.getLogger(true).log('consumer start', commands.length);
                return new Promise((resolve, reject) => {
                    var i = 0;
                    var runCommand = () => {
                        //this.getLogger(true).log('commnads length', commands.length, i);
                        if (commands.length == i) {
                            resolve();
                        } else {
                            let command = commands[i++];
                            if (transformer) {
                                command = transformer(command);
                            }
                            // this.getLogger(true).log('run', commands[i]);
                            this.query(command).then(() => runCommand(), reject).catch(reject);
                        }
                    };
                    runCommand();
                }).catch(e => {
                    this.getLogger(true).error(e);
                    throw e;
                });
            };
            return new Promise((resolve, reject) => {
                var commands = [];
                var tmp = '',
                    m;
                var consumer;
                var inQuotedString;
                var rl = readline.createInterface({
                    input: fs.createReadStream(fileName),
                    terminal: false
                }).on('line', line => {
                    try {
                        // console.log('Line: ' + line);
                        line = line.replace(/--.*$/, ''); // remove comments
                        while (m = SQL_PARSER_REGEXP.exec(line)) {
                            //console.log('inQuotedString', inQuotedString, 'token:', m[0]);
                            if (m[0] == '""' || m[0] == "''") {
                                tmp += m[0];
                            } else if (m[0][0] == '$' || m[0] == '"' || m[0] == "'") {
                                if (!inQuotedString) {
                                    inQuotedString = m[0];
                                } else if (inQuotedString == m[0]) {
                                    inQuotedString = null;
                                }
                                tmp += m[0];
                            } else if (!inQuotedString && m[0] == ';') {
                                commands.push(tmp);
                                if (!consumer) {
                                    consumer = consume(commands).then(() => {
                                        // console.log('consumer done');
                                        consumer = null;
                                        rl.resume();
                                    }, reject);
                                    rl.pause();
                                    commands.length = 0;
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
                        reject();
                    }
                }).on('close', () => {
                    if (tmp.length) {
                        commands.push(tmp);
                    }
                    // console.log('commmands length: ', commands.length);
                    if (!consumer) {
                        if (commands.length) {
                            consumer = consume(commands);
                            commands.length = 0;
                        } else {
                            resolve();
                        }
                    }
                    if (consumer) {
                        if (commands.length) {
                            consumer = consumer.then(() => {
                                return consume(commands);
                            });
                        }
                        consumer.then(() => {
                            // console.log('done');
                            resolve();
                        }).catch(e => {
                            this.getLogger(true).error(e);
                            reject();
                        });
                    }
                });
            });
        });
    }
}
exports.PgDb = PgDb;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PgDb;
//# sourceMappingURL=pgdb.js.map