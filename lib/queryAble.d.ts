/// <reference types="node" />
import { PgDbLogger } from "./pgDbLogger";
import * as stream from "stream";
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string | string[] | {
        [fieldName: string]: 'asc' | 'desc';
    };
    groupBy?: string | string[];
    fields?: string | string[];
    logger?: PgDbLogger;
    forUpdate?: boolean;
    distinct?: boolean;
    skipUndefined?: boolean;
}
export interface SqlQueryOptions {
    logger?: PgDbLogger;
}
export interface ResultFieldType {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
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
export declare type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;
export interface IPgDb {
    connection: any;
    pool: any;
    pgdbTypeParsers: any;
    knownOids: Record<number, boolean>;
    runRestartConnectionForListen(): Promise<Error>;
    needToFixConnectionForListen(): boolean;
    postProcessResult: PostProcessResultFunc;
    resetMissingParsers(connection: any, oidList: number[]): Promise<void>;
}
export declare class QueryAble {
    db: IPgDb & QueryAble;
    schema: any;
    protected logger: PgDbLogger;
    static connectionErrorListener: () => void;
    constructor();
    setLogger(logger: PgDbLogger): void;
    getLogger(useConsoleAsDefault?: boolean): any;
    run(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    query(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    protected internalQuery(options: {
        connection: any;
        sql: string;
        params?: any;
        logger?: any;
    }): Promise<any[]>;
    protected internalQuery(options: {
        connection: any;
        sql: string;
        params?: any;
        logger?: any;
        rowMode: true;
    }): Promise<PgRowResult>;
    queryAsRows(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<PgRowResult>;
    queryWithOnCursorCallback(sql: string, params: any[] | {}, options: SqlQueryOptions, callback: (any: any) => any): Promise<void>;
    queryAsStream(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<stream.Readable>;
    queryOne(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryFirst(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneField(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneColumn(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    private postProcessFields;
    private checkAndFixOids;
    private hasUnknownOids;
}
