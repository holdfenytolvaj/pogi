import { PgDbLogger } from "./pgDbLogger";
import { pgUtils } from "./pgUtils";
import * as stream from "stream";
import * as pg from 'pg';
import util = require('util');
import QueryStream = require('pg-query-stream');
import through = require('through');
import { ResultFieldType } from "./pgDbInterface";
import { SqlQueryOptions, IQueryAble, PgRowResult } from "./queryAbleInterface"
import { PgDb, PgSchema } from ".";


let defaultLogger = {
    log: () => { },
    error: () => { }
};

export abstract class QueryAble implements IQueryAble {
    db!: PgDb & QueryAble;  // assigned in async init
    schema!: PgSchema;
    /*protected*/ logger!: PgDbLogger;

    public static connectionErrorListener = () => { }

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
    async query(sql: string, params?: any[] | {} | null, options?: SqlQueryOptions): Promise<any[]> {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        return this.internalQuery({ connection, sql, params, logger });
    }

    protected async internalQuery(options: { connection: pg.PoolClient | null, sql: string, params?: any, logger?: PgDbLogger }): Promise<any[]>;
    protected async internalQuery(options: { connection: pg.PoolClient | null, sql: string, params?: any, logger?: PgDbLogger, rowMode: true }): Promise<PgRowResult>;
    protected async internalQuery(options: { connection: (pg.PoolClient & { processID?: string }) | null, sql: string, params?: any, logger?: PgDbLogger, rowMode?: boolean }): Promise<any[] | PgRowResult> {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let { connection, sql, params, logger } = options;
        logger = logger || this.getLogger(false);

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }
            let query = options?.rowMode ? { text: sql, values: params, rowMode: 'array' } : { text: sql, values: params };
            let res;
            if (connection) {
                logger.log('reused connection', sql, util.inspect(params, false, null), connection.processID);
                res = await connection.query(query);
                await this.checkAndFixOids(connection, res.fields);
            } else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);

                connection.on('error', QueryAble.connectionErrorListener);
                res = await connection.query(query);
                await this.checkAndFixOids(connection, res.fields);

                connection.off('error', QueryAble.connectionErrorListener);
                connection.release();
                connection = null;
            }
            this.postProcessFields(res.rows, res.fields, logger);
            return options?.rowMode ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
        } catch (e) {
            pgUtils.logError(logger, { error: <Error>e, sql, params, connection });
            if (connection) {
                try {
                    //If any problem has happened in a dedicated connection, (wrong sql format or non-accessible postgres server)
                    //close the connection to be a free connection in the pool,
                    //but keep the db.connection member non - null to crash in all of the following commands
                    connection.release();
                } catch (e) {
                    logger.error('connection error', (<Error>e).message);
                }
            }
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
    async queryWithOnCursorCallback(sql: string, params: any[] | Record<string, any> | null, options: SqlQueryOptions | null, callback: (res: any) => any): Promise<void> {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let connection = this.db.connection!;
        let logger = this.getLogger(true);
        let positionedParams: any[] | undefined;

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            } else {
                positionedParams = params ?? undefined;
            }

            let queryInternal = async () => {
                this.getLogger(false).log(sql, util.inspect(positionedParams, false, null), connection.processID);
                let fieldsToFix: ResultFieldType[] | undefined;
                let isFirst = true;

                let query = new QueryStream(sql, positionedParams);
                let stream = connection.query(query);
                await new Promise((resolve, reject) => {
                    query.handleError = reject;
                    stream.on('data', (res: any) => {
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

                    stream.on('close', resolve);
                    stream.on('error', reject);
                });
                if (fieldsToFix) {
                    await this.checkAndFixOids(connection, fieldsToFix);
                    query = new QueryStream(sql, positionedParams);
                    stream = connection.query(query);
                    await new Promise((resolve, reject) => {
                        query.handleError = reject;
                        stream.on('data', (res: any) => {
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

                        stream.on('close', resolve);
                        stream.on('error', reject);
                    });
                }
            }

            if (connection) {
                await queryInternal();
            } else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(positionedParams, false, null), connection.processID);
                connection.on('error', QueryAble.connectionErrorListener);
                await queryInternal();

                connection.off('error', QueryAble.connectionErrorListener);
                connection.release();
            }
        } catch (e) {
            pgUtils.logError(logger, { error: <Error>e, sql, params, connection });
            if (connection) {
                try {
                    connection.release();
                } catch (e) {
                    logger.error('connection error', (<Error>e).message);
                }
            }
            throw e;
        }
    }

    async queryAsStream(sql: string, params?: any[] | Record<string, any> | null, options?: SqlQueryOptions | null): Promise<stream.Readable> {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        let pgStream: any;
        let queryable = this;
        let isFirst = true;
        let convertTypeFilter = through(function (this: stream, data) {
            try {
                let fields = pgStream._result && pgStream._result.fields || pgStream.cursor._result && pgStream.cursor._result.fields;
                if (isFirst) {
                    if (queryable.hasUnknownOids(fields)) {
                        throw new Error('[337] Query returns fields with unknown oid.');
                    }
                    isFirst = false;
                }
                queryable.postProcessFields([data], fields, queryable.db.logger);

                this.emit('data', data);
            } catch (err) {
                this.emit('error', err);
            }
        });
        convertTypeFilter.on('error', (e: Error) => {
            if (connection) {
                try {
                    connection.release();
                } catch (e) {
                    logger.error('connection error', (<Error>e).message);
                }
            }
            connection = null;
            pgUtils.logError(logger, { error: e, sql, params, connection });
        });

        let positionedParams: any[] | undefined;

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            } else {
                positionedParams = params ?? undefined;
            }

            if (connection) {
                logger.log(sql, util.inspect(positionedParams, false, null), connection.processID);
                let query = new QueryStream(sql, positionedParams);
                query.handleError = (err: Error) => {
                    convertTypeFilter.emit('error', err);
                };
                pgStream = connection.query(query);
                return pgStream.pipe(convertTypeFilter);
            } else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(positionedParams, false, null), connection.processID);
                connection.on('error', QueryAble.connectionErrorListener);

                let query = new QueryStream(sql, positionedParams);
                query.handleError = (err: Error, _connection: pg.PoolClient) => {
                    convertTypeFilter.emit('error', err);
                };
                pgStream = connection.query(query);
                pgStream.on('close', () => {
                    if (connection) {
                        connection.off('error', QueryAble.connectionErrorListener);
                        connection.release();
                    }
                    connection = null;
                });
                pgStream.on('error', (e: Error) => {
                    pgUtils.logError(logger, { error: e, sql, params: positionedParams, connection });

                    if (connection) {
                        connection.off('error', QueryAble.connectionErrorListener);
                        connection.release();
                    }
                    connection = null;
                });
                return pgStream.pipe(convertTypeFilter);
            }
        } catch (e) {
            pgUtils.logError(logger, { error: <Error>e, sql, params: positionedParams, connection });
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

    private postProcessFields(rows: any[], fields: ResultFieldType[], logger: PgDbLogger) {
        pgUtils.postProcessResult(rows, fields, this.db.pgdbTypeParsers);
        if (this.db.postProcessResult) this.db.postProcessResult(rows, fields, logger);
    }

    private async checkAndFixOids(connection: pg.PoolClient, fields: ResultFieldType[]) {
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
