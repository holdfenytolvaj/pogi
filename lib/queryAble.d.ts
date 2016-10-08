/// <reference types="node" />
import { PgDbLogger } from "./pgDb";
import { Readable } from 'stream';
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[] | {
        [fieldName: string]: 'asc' | 'desc';
    };
    groupBy?: string | string[];
    fields?: string | string[];
    logger?: PgDbLogger;
}
export interface SqlQueryOptions {
    logger?: PgDbLogger;
}
export declare class QueryAble {
    db: any;
    schema: any;
    protected logger: PgDbLogger;
    constructor();
    setLogger(logger: PgDbLogger): void;
    protected getLogger(useConsoleAsDefault: any): any;
    run(sql: string): Promise<any[]>;
    /**
     * Params can be
     * 1) array, then sql should have $1 $2 for placeholders
     * 2) object, then sql should have:
     *    :example -> for params in statements (set/where), will be transformed to $1 $2 ...
     *    :!example -> for DDL names (schema, table, column), will be replaced in the query
     * e.g. query('select * from a.b where id=$1;',['the_stage_is_set']);
     * e.g. query('select * from :!schema.:!table where id=:id;',{schema:'a',table:'b', id:'the_stage_is_set'});
     */
    query(sql: string, params?: any[], options?: SqlQueryOptions): Promise<any[]>;
    query(sql: string, params?: Object, options?: SqlQueryOptions): Promise<any[]>;
    queryAsStream(sql: string, params?: any[]): Promise<Readable>;
    queryAsStream(sql: string, params?: Object): Promise<Readable>;
    /** @return one record's one field */
    queryOneField(sql: string, params?: any[], options?: SqlQueryOptions): Promise<any>;
    queryOneField(sql: string, params?: Object, options?: SqlQueryOptions): Promise<any>;
    /** @return one column for the matching records */
    queryOneColumn(sql: string, params?: any[], options?: SqlQueryOptions): Promise<any[]>;
    queryOneColumn(sql: string, params?: Object, options?: SqlQueryOptions): Promise<any[]>;
}
