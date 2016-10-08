import {PgDbLogger} from "./pgDb";
var util = require('util');
var QueryStream = require('pg-query-stream');
import {Readable} from 'stream';
import {pgUtils} from "./pgUtils";

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
                return res.rows;
            } else {
                connection = await this.db.pool.connect();
                logger.log(sql, util.inspect(params, false, null), connection.processID);

                try {
                    let res = await connection.query(sql, params);
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

    public async queryAsStream(sql: string, params?: any[]): Promise<Readable>
    public async queryAsStream(sql: string, params?: Object): Promise<Readable>
    public async queryAsStream(sql: string, params?: any): Promise<Readable> {
        let connection = this.db.connection;

        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }

            if (connection) {
                this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                var query = new QueryStream(sql, params);
                var stream = connection.query(query);
                return stream;
            } else {
                connection = await this.db.pool.connect();
                this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);

                try {
                    var query = new QueryStream(sql, params);
                    var stream = connection.query(query);
                    stream.on('end', ()=>{
                        connection.release();
                    });
                    stream.on('error', ()=>{
                        connection.release();
                    });

                    return stream;
                }  catch (e) {
                    this.getLogger(true).error('connection error', e.message);
                    try{connection.release();} catch(e) {}
                }
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
