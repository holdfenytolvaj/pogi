import { QueryAble, ResultFieldType, IPgDb, PostProcessResultFunc } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
import { PgDbLogger } from './pgDbLogger';
import { ConnectionOptions } from './connectionOptions';
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
    TSVECTOR = 3
}
export declare enum TranzactionIsolationLevel {
    serializable = "SERIALIZABLE",
    repeatableRead = "REPEATABLE READ",
    readCommitted = "READ COMMITTED",
    readUncommitted = "READ UNCOMMITTED"
}
export interface Notification {
    processId: number;
    channel: string;
    payload?: string;
}
export declare class PgDb extends QueryAble implements IPgDb {
    protected static instances: {
        [index: string]: Promise<PgDb>;
    };
    pool: any;
    connection: any;
    config: ConnectionOptions;
    defaultSchemas: any;
    db: PgDb;
    schemas: {
        [name: string]: PgSchema;
    };
    tables: {
        [name: string]: PgTable<any>;
    };
    fn: {
        [name: string]: (...any: any[]) => any;
    };
    [name: string]: any | PgSchema;
    pgdbTypeParsers: Record<string, (string: any) => any>;
    knownOids: Record<number, boolean>;
    postProcessResult: PostProcessResultFunc;
    private constructor();
    setPostProcessResult(f: (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void): void;
    static getInstance(config: ConnectionOptions): Promise<PgDb>;
    close(): Promise<void>;
    static connect(config: ConnectionOptions): Promise<PgDb>;
    private init;
    reload(): Promise<void>;
    private initSchemasAndTables;
    private setDefaultTablesAndFunctions;
    private initFieldTypes;
    setTypeParser(typeName: string, parser: (string: any) => any, schemaName?: string): Promise<void>;
    setPgDbTypeParser(typeName: string, parser: (string: any) => any, schemaName?: string): Promise<void>;
    resetMissingParsers(connection: any, oidList: number[]): Promise<void>;
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
    execute(fileName: string, statementTransformerFunction?: (string: any) => string): Promise<void>;
    private listeners;
    private connectionForListen;
    private _needToRestartConnectionForListen;
    private restartConnectionForListen;
    listen(channel: string, callback: (notification: Notification) => void): Promise<void>;
    unlisten(channel: string, callback?: (Notification: any) => void): Promise<void>;
    notify(channel: string, payload?: string): Promise<any[]>;
    runRestartConnectionForListen(): Promise<Error>;
    needToFixConnectionForListen(): boolean;
    private tryToFixConnectionForListenActively;
    notificationListener: (notification: Notification) => boolean;
    errorListener: (e: any) => void;
    private initConnectionForListen;
}
export default PgDb;
