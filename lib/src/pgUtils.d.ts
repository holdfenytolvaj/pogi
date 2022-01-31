import { QueryOptions, IQueryAble } from "./queryAbleInterface";
import { ResultFieldType } from "./pgDbInterface";
import { FieldType } from "./pgDb";
import { PgDbLogger } from "./pgDbLogger";
import { IPgTable } from "./pgTableInterface";
import * as pg from 'pg';
export declare let pgUtils: {
    logError(logger: PgDbLogger, options: {
        error?: string | Error;
        sql: string;
        params: any;
        connection?: pg.PoolClient | null;
    }): void;
    quoteFieldNameInsecure(f: string): string;
    quoteFieldName(f: string): string;
    quoteFieldNameOrPositionInsecure(f: string | number): string;
    quoteFieldNameOrPosition(f: string | number): string;
    quoteFieldNameJsonbOrPosition(f: string | number): string;
    processQueryFields<T>(options: QueryOptions, pgTable?: IPgTable<T> | undefined): string;
    processNamedParams(sql: string, params: Object): {
        sql: string;
        params: any[];
    };
    handleColumnEscapeGroupBy<T_1>(options: QueryOptions, pgTable?: IPgTable<T_1> | undefined): string;
    handleColumnEscapeOrderBy<T_2>(options: QueryOptions, pgTable: IPgTable<T_2>): string;
    processQueryOptions<T_3>(options: QueryOptions, pgTable: IPgTable<T_3>): string;
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
