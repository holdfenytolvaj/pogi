import { QueryAble, ResultFieldType } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
    TSVECTOR = 3,
}
export interface ConnectionOptions {
    host?: string;
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    poolSize?: number;
    rows?: number;
    min?: number;
    max?: number;
    binary?: boolean;
    poolIdleTimeout?: number;
    reapIntervalMillis?: number;
    poolLog?: boolean;
    client_encoding?: string;
    ssl?: boolean | any;
    application_name?: string;
    fallback_application_name?: string;
    parseInputDatesAsUTC?: boolean;
    connectionString?: string;
    idleTimeoutMillis?: number;
    logger?: PgDbLogger;
    skipUndefined?: 'all' | 'select' | 'none';
}
export interface PgDbLogger {
    log: Function;
    error: Function;
}
export declare type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;
export declare class PgDb extends QueryAble {
    protected static instances: {
        [index: string]: Promise<PgDb>;
    };
    pool: any;
    protected connection: any;
    config: ConnectionOptions;
    defaultSchemas: any;
    db: any;
    schemas: {
        [name: string]: PgSchema;
    };
    tables: {
        [name: string]: PgTable<any>;
    };
    fn: {
        [name: string]: (...any) => any;
    };
    [name: string]: any | PgSchema;
    pgdbTypeParsers: {};
    postProcessResult: PostProcessResultFunc;
    private constructor();
    setPostProcessResult(f: (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void): void;
    static getInstance(config: ConnectionOptions): Promise<PgDb>;
    close(): Promise<void>;
    static connect(config: ConnectionOptions): Promise<PgDb>;
    private init();
    reload(): Promise<void>;
    private initSchemasAndTables();
    private setDefaultTablesAndFunctions();
    private initFieldTypes();
    setTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void>;
    setPgDbTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void>;
    dedicatedConnectionBegin(): Promise<PgDb>;
    dedicatedConnectionEnd(): Promise<PgDb>;
    transactionBegin(): Promise<PgDb>;
    transactionCommit(): Promise<PgDb>;
    transactionRollback(): Promise<PgDb>;
    isTransactionActive(): boolean;
    execute(fileName: any, statementTransformerFunction?: (string) => string): Promise<void>;
}
export default PgDb;
