/// <reference types="node" />
import { PgDbLogger } from "./pgDbLogger";
import * as stream from "stream";
import { IPgSchema } from "./pgSchemaInterface";
import * as pg from 'pg';
import { IPgDb } from "./pgDbInterface";
import { SqlQueryOptions, IQueryAble, PgRowResult } from "./queryAbleInterface";
export declare abstract class QueryAble implements IQueryAble {
    db: IPgDb & IQueryAble;
    schema: IPgSchema;
    logger: PgDbLogger;
    static connectionErrorListener: () => void;
    setLogger(logger: PgDbLogger): void;
    getLogger(useConsoleAsDefault?: boolean): PgDbLogger;
    run(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    query(sql: string, params?: any[] | {} | null, options?: SqlQueryOptions): Promise<any[]>;
    protected internalQuery(options: {
        connection: pg.PoolClient | null;
        sql: string;
        params?: any;
        logger?: PgDbLogger;
    }): Promise<any[]>;
    protected internalQuery(options: {
        connection: pg.PoolClient | null;
        sql: string;
        params?: any;
        logger?: PgDbLogger;
        rowMode: true;
    }): Promise<PgRowResult>;
    queryAsRows(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<PgRowResult>;
    queryWithOnCursorCallback(sql: string, params: any[] | Record<string, any> | null, options: SqlQueryOptions | null, callback: (res: any) => any): Promise<void>;
    queryAsStream(sql: string, params?: any[] | Record<string, any> | null, options?: SqlQueryOptions | null): Promise<stream.Readable>;
    queryOne(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryFirst(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneField(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any>;
    queryOneColumn(sql: string, params?: any[] | {}, options?: SqlQueryOptions): Promise<any[]>;
    private postProcessFields;
    private checkAndFixOids;
    private hasUnknownOids;
}
