import stream from "stream";
import { ForceEscapeColumnsOptions } from "./connectionOptions.js";
import { PgDb, PgSchema } from "./index.js";
import { ResultFieldType } from "./pgDbInterface.js";
import { PgDbLogger } from "./pgDbLogger.js";
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[] | {
        [fieldName: string]: 'asc' | 'desc';
    };
    orderByNullsFirst?: boolean;
    groupBy?: string | string[];
    fields?: string | string[];
    logger?: PgDbLogger;
    forUpdate?: boolean;
    distinct?: boolean;
    skipUndefined?: boolean;
    forceEscapeColumns?: boolean | ForceEscapeColumnsOptions;
}
export interface SqlQueryOptions {
    logger?: PgDbLogger;
}
export interface ResultType {
    command: 'SELECT' | 'UPDATE' | 'DELETE';
    rowCount: number;
    oid: number;
    rows: any[];
    fields: ResultFieldType[];
    _parsers: Function[][];
    RowCtor: Function[];
    rowsAsArray: boolean;
    _getTypeParser: Function[];
}
export interface PgRowResult {
    columns: string[];
    rows: any[];
}
export interface IQueryAble {
    db: PgDb & IQueryAble;
    schema: PgSchema;
    logger: PgDbLogger;
    setLogger(logger: PgDbLogger): void;
    getLogger(useConsoleAsDefault: boolean): PgDbLogger;
    run(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    query(sql: string, params?: any[] | {} | null, options?: SqlQueryOptions): Promise<any[]>;
    queryAsRows(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<PgRowResult>;
    queryWithOnCursorCallback(sql: string, params: any[] | Record<string, any> | null, options: SqlQueryOptions | null, callback: (res: any) => any): Promise<void>;
    queryAsStream(sql: string, params?: any[] | Record<string, any> | null, options?: SqlQueryOptions | null): Promise<stream.Readable>;
    queryOne(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryFirst(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneField(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneColumn(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
}
