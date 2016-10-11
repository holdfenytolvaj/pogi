import { QueryAble } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
}
export interface ConnectionOptions {
    host?: string;
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    poolSize?: number;
    rows?: number;
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
}
/**
 * log will get 3 parameters:
 *    sql -> the query
 *    parameters -> parameters for the query
 *    poolId -> the id of the connection
 */
export interface PgDbLogger {
    log: Function;
    error: Function;
}
export declare class PgDb extends QueryAble {
    protected static instances: {
        [index: string]: Promise<PgDb>;
    };
    pool: any;
    connection: any;
    config: ConnectionOptions;
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
    private defaultLogger;
    [name: string]: any | PgSchema;
    pgdbTypeParsers: {};
    private constructor(pgdb?);
    /** If planned to used as a static singleton */
    static getInstance(config: ConnectionOptions): Promise<PgDb>;
    close(): Promise<void>;
    static connect(config: ConnectionOptions): Promise<PgDb>;
    private init();
    reload(): Promise<void>;
    private initSchemasAndTables();
    private initFieldTypes();
    /**
     * if schemaName is null, it will be applied for all schemas
     */
    setTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void>;
    setPgDbTypeParser(typeName: string, parser: (string) => any, schemaName?: string): Promise<void>;
    /**
     * @param connectionMode pool|one
     */
    private setConnectionMode(connectionMode);
    transactionBegin(): Promise<PgDb>;
    transactionCommit(): Promise<PgDb>;
    transactionRollback(): Promise<PgDb>;
    isTransactionActive(): boolean;
    execute(fileName: any, transformer?: (string) => string): Promise<void>;
}
export default PgDb;
