import { QueryAble, ResultFieldType } from "./queryAble";
import { PgTable } from "./pgTable";
import { PgSchema } from "./pgSchema";
import { PgDbLogger } from './pgDbLogger';
import { ConnectionOptions } from './connectionOptions';
export declare enum FieldType {
    JSON = 0,
    ARRAY = 1,
    TIME = 2,
    TSVECTOR = 3,
}
export declare type PostProcessResultFunc = (res: any[], fields: ResultFieldType[], logger: PgDbLogger) => void;
export declare class PgDb extends QueryAble {
    protected static instances: {
        [index: string]: Promise<PgDb>;
    };
    pool: any;
    connection: any;
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
