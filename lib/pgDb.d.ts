import { QueryAble } from "./queryAble";
import { IPgDb, ResultFieldType, PostProcessResultFunc, Notification, TranzactionIsolationLevel } from "./pgDbInterface";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
import * as pg from 'pg';
import { PgDbLogger } from './pgDbLogger';
import { ConnectionOptions } from './connectionOptions';
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
    TSVECTOR = 3
}
export declare class PgDb extends QueryAble implements IPgDb {
    protected static instances: {
        [index: string]: Promise<PgDb>;
    };
    pool: pg.Pool;
    connection: pg.PoolClient | null;
    config: ConnectionOptions;
    defaultSchemas: string[];
    db: IPgDb;
    schemas: {
        [name: string]: PgSchema;
    };
    tables: {
        [name: string]: PgTable<any>;
    };
    fn: {
        [name: string]: (...args: any[]) => any;
    };
    [name: string]: any | PgSchema;
    pgdbTypeParsers: Record<string, (s: any) => any>;
    knownOids: Record<number, boolean>;
    postProcessResult: PostProcessResultFunc | undefined | null;
    private constructor();
    setPostProcessResult(f: null | ((res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void)): void;
    static getInstance(config: ConnectionOptions): Promise<PgDb>;
    close(): Promise<void>;
    static connect(config: ConnectionOptions): Promise<PgDb>;
    private init;
    reload(): Promise<void>;
    private initSchemasAndTables;
    private setDefaultTablesAndFunctions;
    private initFieldTypes;
    setTypeParser(typeName: string, parser: (s: string) => any, schemaName?: string): Promise<void>;
    setPgDbTypeParser(typeName: string, parser: (s: string) => any, schemaName?: string): Promise<void>;
    resetMissingParsers(connection: pg.PoolClient, oidList: number[]): Promise<void>;
    dedicatedConnectionBegin(): Promise<PgDb>;
    dedicatedConnectionEnd(): Promise<PgDb>;
    savePoint(name: string): Promise<PgDb>;
    savePointRelease(name: string): Promise<PgDb>;
    transactionBegin(options?: {
        isolationLevel?: TranzactionIsolationLevel;
        deferrable?: boolean;
        readOnly?: boolean;
    }): Promise<PgDb>;
    transactionCommit(): Promise<PgDb>;
    transactionRollback(options?: {
        savePoint?: string;
    }): Promise<PgDb>;
    isTransactionActive(): boolean;
    execute(fileName: string, statementTransformerFunction?: (s: string) => string): Promise<void>;
    private listeners;
    private connectionForListen;
    private _needToRestartConnectionForListen;
    private restartConnectionForListen;
    listen(channel: string, callback: (notification: Notification) => void): Promise<void>;
    unlisten(channel: string, callback?: (notification: Notification) => void): Promise<void>;
    notify(channel: string, payload?: string): Promise<any[]>;
    runRestartConnectionForListen(): Promise<Error | null>;
    needToFixConnectionForListen(): boolean;
    private tryToFixConnectionForListenActively;
    notificationListener: (notification: Notification) => boolean;
    errorListener: (e: Error) => void;
    private initConnectionForListen;
}
export default PgDb;
