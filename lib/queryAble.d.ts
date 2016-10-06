/// <reference types="node" />
import { PgDbLogger } from "./pgdb";
import { Readable } from 'stream';
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[];
    groupBy?: string | string[];
    fields?: string | string[];
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
    query(sql: string, params?: any[]): Promise<any[]>;
    query(sql: string, params?: Object): Promise<any[]>;
    queryAsStream(sql: string, params?: any[]): Promise<Readable>;
    queryAsStream(sql: string, params?: Object): Promise<Readable>;
    /** @return one record's one field */
    getOneField(sql: string, params?: any[]): any;
    getOneField(sql: string, params?: Object): any;
    /** @return one column for the matching records */
    getOneColumn(sql: string, params?: any[]): any;
    getOneColumn(sql: string, params?: Object): any;
    /**
     * :named -> $1 (not works with DDL (schema, table, column))
     * :!named -> "value" (for DDL (schema, table, column))
     * do not touch ::type cast
     */
    private processNamedParams(sql, params);
    static processQueryOptions(options: QueryOptions): string;
}
