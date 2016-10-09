import {PgDbLogger} from "./pgDb";
var util = require('util');
var QueryStream = require('pg-query-stream');
import {Readable} from 'stream';
import {pgUtils} from "./pgUtils";
var through = require('through');

export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string|string[]|{[fieldName:string]:'asc'|'desc'};//free text or column list
    groupBy?: string|string[];//free text or column list
    fields?: string|string[];//free text or column list
    logger?: PgDbLogger;
}

export interface SqlQueryOptions {
    logger?: PgDbLogger;
}

export interface ResultFieldType {
    name: string,
    tableID: number,
    columnID: number,
    dataTypeID: number,
    dataTypeSize: number,
    dataTypeModifier: number,
    format: string
}
export interface ResultType {
    command: 'SELECT'|'UPDATE'|'DELETE',
    rowCount: number,
    oid: number,
    rows: any[],
    fields: ResultFieldType[],
    _parsers: Function[][],
    RowCtor: Function[],
    rowsAsArray: boolean,
    _getTypeParser: Function[]
}

export class QueryAble {
    db;
    schema;
    protected logger: PgDbLogger;

    constructor() {
    }

    public setLogger(logger: PgDbLogger) {
        this.logger = logger;
    }

    protected getLogger(useConsoleAsDefault) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : this.db.defaultLogger);
    }

    public async run(sql: string): Promise<any[]> {
        return this.query(sql);
    }

    /**
     * Params can be
     * 1) array, then sql should have $1 $2 for placeholders
     * 2) object, then sql should have:
     *    :example -> for params in statements (set/where), will be transformed to $1 $2 ...
     *    :!example -> for DDL names (schema, table, column), will be replaced in the query
     * e.g. query('select * from a.b where id=$1;',['the_stage_is_set']);
     * e.g. query('select * from :!schema.:!table where id=:id;',{schema:'a',table:'b', id:'the_stage_is_set'});
     */
    public async query(sql: string, params?: any[], options?:SqlQueryOptions): Promise<any[]>
    public async query(sql: string, params?: Object, options?:SqlQueryOptions): Promise<any[]>
    public async query(sql: string, params?: any, options?:SqlQueryOptions): Promise<any[]> {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            if (connection) {
                logger.log(sql, util.inspect(params, false, null), connection.processID);
                let res = await connection.query(sql, params);
                pgUtils.convertTypes(res.rows, res.fields, this.db.pgdbTypeParsers);
                return res.rows;
            } else {
                connection = await this.db.pool.connect();
                logger.log(sql, util.inspect(params, false, null), connection.processID);

                try {
                    let res = await connection.query(sql, params);
                    pgUtils.convertTypes(res.rows, res.fields, this.db.pgdbTypeParsers);
                    return res.rows;
                } finally {
                    try {
                        connection.release();
                    } catch (e) {
                        connection = null;
                        logger.error('connection error', e.message);
                    }
                }
            }
        } catch (e) {
            logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
            throw e;
        }
    }

    public async queryWithOnCursorCallback(sql: string, params: any[],  callback:(any)=>void): Promise<void>
    public async queryWithOnCursorCallback(sql: string, params: Object, callback:(any)=>void): Promise<void>
    public async queryWithOnCursorCallback(sql: string, params: any,    callback:(any)=>void): Promise<void> {
        let connection = this.db.connection;

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            try {
                if (connection) {
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    var query = new QueryStream(sql, params);
                    var stream = connection.query(query);
                    await new Promise((resolve, reject) => {
                        stream.on('data', (res) => {
                            try {
                                pgUtils.convertTypes([res], stream._result.fields, this.db.pgdbTypeParsers);
                                callback(res);
                            } catch (e) {
                                reject(e);
                            }
                        });

                        stream.on('end', resolve);
                        stream.on('error', reject);
                    });

                } else {
                    connection = await this.db.pool.connect();
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    var query = new QueryStream(sql, params);
                    var stream = connection.query(query);
                    await new Promise((resolve, reject) => {
                        stream.on('data', (res) => {
                            try {
                                pgUtils.convertTypes([res], stream._result.fields, this.db.pgdbTypeParsers);
                                callback(res);
                            } catch (e) {
                                reject(e);
                            }
                        });

                        stream.on('end', resolve);
                        stream.on('error', reject);
                    });
                }
            } finally {
                try {
                    connection.release();
                } catch (e) {
                    this.getLogger(true).error('connection error', e.message);
                }
            }
        } catch (e) {
            this.getLogger(true).error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
            throw e;
        }
    }

    public async queryAsStream(sql: string, params?: any[]): Promise<Readable>
    public async queryAsStream(sql: string, params?: Object): Promise<Readable>
    public async queryAsStream(sql: string, params?: any): Promise<Readable> {
        let connection = this.db.connection;


        let pgStream;
        let pgdb = this.db;
        let convertTypeFilter = through(function(data) {
            try {
                pgUtils.convertTypes([data], pgStream._result.fields, pgdb.pgdbTypeParsers);
                this.emit('data', data);
            } catch (err) {
                this.emit('error', err);
            }
        });

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            if (connection) {
                this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                var query = new QueryStream(sql, params);
                pgStream = connection.query(query);
                return pgStream.pipe(convertTypeFilter);
            } else {
                connection = await this.db.pool.connect();
                this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                var query = new QueryStream(sql, params);
                pgStream = connection.query(query);
                pgStream.on('end',()=> {
                    connection.release();
                    connection = null;
                });
                pgStream.on('error',()=> {
                    connection.release();
                    connection = null;
                });
                convertTypeFilter.on('close',()=> {
                    if (connection) connection.release();
                    connection = null;
                });
                convertTypeFilter.on('error',()=> {
                    if (connection) connection.release();
                    connection = null;
                });
                return pgStream.pipe(convertTypeFilter);
            }
        } catch (e) {
            this.getLogger(true).error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
            throw e;
        }
    }

    /** @return one record's one field */
    public async queryOneField(sql: string, params?: any[], options?:SqlQueryOptions): Promise<any>
    public async queryOneField(sql: string, params?: Object, options?:SqlQueryOptions): Promise<any>
    public async queryOneField(sql: string, params?: any, options?:SqlQueryOptions): Promise<any> {
        let res = await this.query(sql, params, options);
        let fieldName = Object.keys(res[0])[0];
        if (res.length > 1) {
            throw Error('More then one field exists!');
        }
        return res.length == 1 ? res[0][fieldName] : null;
    }

    /** @return one column for the matching records */
    public async queryOneColumn(sql: string, params?: any[], options?:SqlQueryOptions): Promise<any[]>
    public async queryOneColumn(sql: string, params?: Object, options?:SqlQueryOptions): Promise<any[]>
    public async queryOneColumn(sql: string, params?: any, options?:SqlQueryOptions): Promise<any[]> {
        let res = await this.query(sql, params, options);
        let fieldName = Object.keys(res[0])[0];
        return res.map(r=>r[fieldName]);
    }
}
