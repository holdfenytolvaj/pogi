import stream from "node:stream";
import pg from 'pg';
import { PgDb, PgSchema } from "./index.js";
import { PgDbLogger } from "./pgDbLogger.js";
import { IQueryAble, PgRowResult, SqlQueryOptions } from "./queryAbleInterface.js";
export declare abstract class QueryAble implements IQueryAble {
    db: PgDb & QueryAble;
    schema: PgSchema;
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
