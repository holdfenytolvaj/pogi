import { PgDbLogger } from "./pgDbLogger";
import { IPgSchema } from "./pgSchemaInterface";
import * as stream from "stream";
import { ResultFieldType, IPgDb } from "./pgDbInterface";

export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[] | { [fieldName: string]: 'asc' | 'desc' };//free text or column list
    /** 
     * only used with orderBy
     * true -> nulls first, 
     * false -> nulls last 
     */
    orderByNullsFirst?: boolean;
    groupBy?: string | string[];//free text or column list
    fields?: string | string[];//free text or column list
    logger?: PgDbLogger;
    forUpdate?: boolean;
    distinct?: boolean;
    skipUndefined?: boolean;
    forceEscapeColumns?: boolean | {
        select?: boolean
        where?: boolean
        orderBy?: boolean
        groupBy?: boolean
    }
}

export interface SqlQueryOptions {
    logger?: PgDbLogger;
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



export interface IQueryAble {
    db: IPgDb & IQueryAble;  // assigned in async init
    schema: IPgSchema;
    logger: PgDbLogger;

    /*connectionErrorListener : () => { }*/

    setLogger(logger: PgDbLogger): void

    getLogger(useConsoleAsDefault: boolean): PgDbLogger

    /** alias to {@link query} */
    run(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>

    /**
     * Params can be
     * 1) array, then sql should have $1 $2 for placeholders
     * 2) object, then sql should have:
     *    :example -> for params in statements (set/where), will be transformed to $1 $2 ...
     *    :!example -> for DDL names (schema, table, column), will be replaced in the query
     * e.g. query('select * from a.b where id=$1;',['the_stage_is_set']);
     * e.g. query('select * from :!schema.:!table where id=:id;',{schema:'a',table:'b', id:'the_stage_is_set'});
     */
    query(sql: string, params?: any[] | {} | null, options?: SqlQueryOptions): Promise<any[]>

    /**
     * Same as query but response is two array: columns and rows and rows are arrays also not objects
     * This is useful for queries which have colliding column names
     */
    queryAsRows(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<PgRowResult>

    /**
     * If the callback function return true, the connection will be closed.
     */
    queryWithOnCursorCallback(sql: string, params: any[] | Record<string, any> | null, options: SqlQueryOptions | null, callback: (res: any) => any): Promise<void>

    queryAsStream(sql: string, params?: any[] | Record<string, any> | null, options?: SqlQueryOptions | null): Promise<stream.Readable>

    queryOne(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>

    queryFirst(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>

    /** @return one record's one field */
    queryOneField(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>

    /** @return one column for the matching records */
    queryOneColumn(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>

}
