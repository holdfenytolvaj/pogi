import { QueryAble, ResultFieldType } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
    TSVECTOR = 3,
}
/**
 * @property connectionString e.g.: "postgres://user@localhost/database"
 * @property user can be specified through PGHOST env variable
 * @property user can be specified through PGUSER env variable (defaults USER env var)
 * @property database can be specified through PGDATABASE env variable (defaults USER env var)
 * @property password can be specified through PGPASSWORD env variable
 * @property port can be specified through PGPORT env variable
 * @property idleTimeoutMillis how long a client is allowed to remain idle before being closed
 * @property skipUndefined if there is a undefined value in the condition, what should pogi do. Default is 'none', meaning raise error if a value is undefined.
 */
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
    /** If planned to used as a static singleton */
    static getInstance(config: ConnectionOptions): Promise<PgDb>;
    close(): Promise<void>;
    static connect(config: ConnectionOptions): Promise<PgDb>;
    private init();
    reload(): Promise<void>;
    private initSchemasAndTables();
    private setDefaultTablesAndFunctions();
    private initFieldTypes();
    /**
     * if schemaName is null, it will be applied for all schemas
     */
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
