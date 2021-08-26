import { PgDbLogger } from "./pgDbLogger";
import { pgUtils } from "./pgUtils";
import * as stream from "stream";

const util = require('util');
const QueryStream = require('pg-query-stream');
const through = require('through');

export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[] | { [fieldName: string]: 'asc' | 'desc' };//free text or column list
    groupBy?: string | string[];//free text or column list
    fields?: string | string[];//free text or column list
    logger?: PgDbLogger;
    forUpdate?: boolean;
    distinct?: boolean;
    skipUndefined?: boolean;
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
    command: 'SELECT' | 'UPDATE' | 'DELETE',
    rowCount: number,
    oid: number,
    rows: any[],
    fields: ResultFieldType[],
    _parsers: Function[][],
    RowCtor: Function[],
    rowsAsArray: boolean,
    _getTypeParser: Function[]
}

export interface PgRowResult {
    columns: string[],
    rows: any[]
}

let defaultLogger = {
    log: () => { },
    error: () => { }
};

export class QueryAble {
    db;
    schema;
    protected logger: PgDbLogger;

    constructor() {
    }

    setLogger(logger: PgDbLogger) {
        this.logger = logger;
    }

    getLogger(useConsoleAsDefault = false) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : defaultLogger);
    }

    /** alias to {@link query} */
    async run(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]> {
        return this.query(sql, params, options);
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
    async query(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]> {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        return this.internalQuery({ connection, sql, params, logger });
    }

    protected async internalQuery(options: { connection, sql: string, params?: any, logger?}): Promise<any[]>;
    protected async internalQuery(options: { connection, sql: string, params?: any, logger?, rowMode: true }): Promise<PgRowResult>;
    protected async internalQuery(options: { connection, sql: string, params?: any, logger?, rowMode?: boolean }): Promise<any[] | PgRowResult> {
        let { connection, sql, params, logger } = options;
        logger = logger || this.getLogger(false);

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            if (connection) {
                logger.log('reused connection', sql, util.inspect(params, false, null), connection.processID);
                let res = await connection.query({ text: sql, values: params, rowMode: options?.rowMode ? 'array' : undefined });
                await this.checkAndFixOids(connection, res.fields);
                this.postProcessFields(res.rows, res.fields, logger);

                return options?.rowMode ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
            } else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);

                try {
                    let res = await connection.query({ text: sql, values: params, rowMode: options?.rowMode ? 'array' : undefined });
                    await this.checkAndFixOids(connection, res.fields);
                    connection.release();
                    connection = null;
                    this.postProcessFields(res.rows, res.fields, logger);

                    return options?.rowMode ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
                } catch (e) {
                    pgUtils.logError(logger, { error: e, sql, params, connection });
                    try {
                        if (connection)
                            connection.release();
                    } catch (e) {
                        logger.error('connection error2', e.message);
                    }
                    connection = null;
                    throw e;
                }
            }
        } catch (e) {
            pgUtils.logError(logger, { error: e, sql, params, connection });
            throw e;
        }
    }

    /**
     * Same as query but response is two array: columns and rows and rows are arrays also not objects
     * This is useful for queries which have colliding column names
     */
    async queryAsRows(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<PgRowResult> {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        return this.internalQuery({ connection, sql, params, logger, rowMode: true });
    }

    /**
     * If the callback function return true, the connection will be closed.
     */
    async queryWithOnCursorCallback(sql: string, params: any[] | {}, options: SqlQueryOptions, callback: (any) => any): Promise<void> {
        let connection = this.db.connection;

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            let queryInternal = async () => {
                this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                let fieldsToFix: ResultFieldType[];
                let isFirst = true;

                let query = new QueryStream(sql, params);
                let stream = connection.query(query);
                await new Promise((resolve, reject) => {
                    stream.on('data', (res) => {
                        try {
                            let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                            if (isFirst) {
                                if (this.hasUnknownOids(fields)) {
                                    fieldsToFix = fields;
                                    stream.destroy();
                                    return;
                                }
                                isFirst = false;
                            }
                            this.postProcessFields([res], fields, this.getLogger(false));

                            if (callback(res)) {
                                stream.destroy();
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });

                    stream.on('end', v => {
                        resolve(v);
                    });
                    stream.on('error', reject);
                });
                if (fieldsToFix) {
                    await this.checkAndFixOids(connection, fieldsToFix);
                    query = new QueryStream(sql, params);
                    stream = connection.query(query);
                    await new Promise((resolve, reject) => {
                        stream.on('data', (res) => {
                            try {
                                let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                                this.postProcessFields([res], fields, this.getLogger(false));

                                if (callback(res)) {
                                    stream.destroy();
                                }
                            } catch (e) {
                                reject(e);
                            }
                        });

                        stream.on('end', resolve);
                        stream.on('error', reject);
                    });
                }
            }

            if (connection) {
                await queryInternal();
            } else {
                try {
                    connection = await this.db.pool.connect();
                    await queryInternal();
                } finally {
                    try {
                        connection.release();
                    } catch (e) {
                        this.getLogger(true).error('connection error', e.message);
                    }
                }
            }
        } catch (e) {
            let logger = this.getLogger(true);
            pgUtils.logError(logger, { error: e, sql, params, connection });
            throw e;
        }
    }

    async queryAsStream(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<stream.Readable> {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        let pgStream;
        let queriable = this;
        let isFirst = true;
        let convertTypeFilter = through(function (data) {
            try {
                let fields = pgStream._result && pgStream._result.fields || pgStream.cursor._result && pgStream.cursor._result.fields;
                if (isFirst) {
                    if (queriable.hasUnknownOids(fields)) {
                        throw new Error('[337] Query returns fields with unknown oid.');
                    }
                    isFirst = false;
                }
                queriable.postProcessFields([data], fields, queriable.db.pgdbTypeParsers);

                this.emit('data', data);
            } catch (err) {
                this.emit('error', err);
            }
        });
        convertTypeFilter.on('error', (e) => {
            pgUtils.logError(logger, { error: e, sql, params, connection });
        });

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            if (connection) {
                logger.log(sql, util.inspect(params, false, null), connection.processID);
                let query = new QueryStream(sql, params);
                pgStream = connection.query(query);
                return pgStream.pipe(convertTypeFilter);
            } else {
                connection = await this.db.pool.connect();
                logger.log(sql, util.inspect(params, false, null), connection.processID);
                let query = new QueryStream(sql, params);
                pgStream = connection.query(query);
                pgStream.on('close', () => {
                    if (connection) connection.release();
                    connection = null;
                });
                pgStream.on('error', (e) => {
                    pgUtils.logError(logger, { error: e, sql, params, connection });
                    if (connection) connection.release();
                    connection = null;
                });
                return pgStream.pipe(convertTypeFilter);
            }
        } catch (e) {
            pgUtils.logError(logger, { error: e, sql, params, connection });
            throw e;
        }
    }

    async queryOne(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any> {
        let res = await this.query(sql, params, options);
        if (res.length > 1) {
            let logger = (options && options.logger || this.getLogger(false));
            let error = Error('More then one rows exists');
            pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
            throw error;
        }
        return res[0];
    }

    async queryFirst(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any> {
        let res = await this.query(sql, params, options);
        return res[0];
    }

    /** @return one record's one field */
    async queryOneField(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any> {
        let res = await this.query(sql, params, options);
        if (!res.length) {
            return null;
        }
        let fieldName = Object.keys(res[0])[0];
        if (res.length > 1) {
            let logger = (options && options.logger || this.getLogger(false));
            let error = Error('More then one field exists!');
            pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
            throw error;
        }
        return res.length == 1 ? res[0][fieldName] : null;
    }

    /** @return one column for the matching records */
    async queryOneColumn(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]> {
        let res = await this.query(sql, params, options);
        if (!res.length) {
            return [];
        }
        let fieldName = Object.keys(res[0])[0];
        return res.map(r => r[fieldName]);
    }

    private postProcessFields(rows: any[], fields: ResultFieldType[], logger) {
        pgUtils.postProcessResult(rows, fields, this.db.pgdbTypeParsers);
        if (this.db.postProcessResult) this.db.postProcessResult(rows, fields, logger);
    }

    private async checkAndFixOids(connection, fields: ResultFieldType[]) {
        if (fields) {
            let oidList = fields.map(field => field.dataTypeID);
            return this.db.resetMissingParsers(connection, oidList);
        }
    }

    private hasUnknownOids(fields: ResultFieldType[]): boolean {
        let oidList = fields.map(field => field.dataTypeID);
        let unknownOids = oidList.filter(oid => !this.db.knownOids[oid]);
        return !!unknownOids.length;
    }
}
