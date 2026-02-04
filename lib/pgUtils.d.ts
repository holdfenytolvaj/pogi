import pg from 'pg';
import { PgTable } from "./index.js";
import { FieldType } from "./pgDb.js";
import { ResultFieldType } from "./pgDbInterface.js";
import { PgDbLogger } from "./pgDbLogger.js";
import { IQueryAble, QueryOptions } from "./queryAbleInterface.js";
export declare let pgUtils: {
    logError(logger: PgDbLogger, options: {
        error?: string | Error;
        sql: string;
        params: any;
        connection?: (pg.PoolClient & {
            processID?: string;
        }) | null;
    }): void;
    quoteFieldNameInsecure(f: string): string;
    quoteFieldName(f: string): string;
    quoteFieldNameOrPositionInsecure(f: string | number): string;
    quoteFieldNameOrPosition(f: string | number): string;
    quoteFieldNameJsonbOrPosition(f: string | number): string;
    processQueryFields<T>(options: QueryOptions, pgTable: PgTable<T>): string;
    processNamedParams(sql: string, params: Object): {
        sql: string;
        params: string[];
    };
    handleColumnEscapeGroupBy<T>(options: QueryOptions, pgTable?: PgTable<T>): string;
    handleColumnEscapeOrderBy<T>(options: QueryOptions, pgTable: PgTable<T>): string;
    processQueryOptions<T>(options: QueryOptions, pgTable: PgTable<T>): string;
    transformInsertUpdateParams(param: any, fieldType: FieldType): any;
    postProcessResult(res: any[], fields: ResultFieldType[], pgdbTypeParsers: {
        [oid: number]: (s: string) => any;
    }): void;
    convertTypes(res: any[], fields: ResultFieldType[], pgdbTypeParsers: {
        [oid: number]: (s: string) => any;
    }): void;
    createFunctionCaller(q: IQueryAble, fn: {
        schema: string;
        name: string;
        return_single_row: boolean;
        return_single_value: boolean;
    }): (...args: any[]) => Promise<any>;
    escapeForLike(s: string): string;
};
