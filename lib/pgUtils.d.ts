import { QueryOptions, ResultFieldType, QueryAble } from "./queryAble";
import { FieldType } from "./pgDb";
import { PgDbLogger } from "./pgDbLogger";
export declare let pgUtils: {
    logError(logger: PgDbLogger, sql: string, queryParams: any, connection: any): void;
    quoteField(f: any): any;
    processQueryFields(options: QueryOptions): string;
    processNamedParams(sql: string, params: Object): {
        sql: string;
        params: any[];
    };
    processQueryOptions(options: QueryOptions): string;
    transformInsertUpdateParams(param: any, fieldType: FieldType): any;
    postProcessResult(res: any[], fields: ResultFieldType[], pgdbTypeParsers: {
        [oid: number]: (string: any) => any;
    }): void;
    convertTypes(res: any[], fields: ResultFieldType[], pgdbTypeParsers: {
        [oid: number]: (string: any) => any;
    }): void;
    createFunctionCaller(q: QueryAble, fn: {
        schema: string;
        name: string;
        return_single_row: boolean;
        return_single_value: boolean;
    }): (...args: any[]) => Promise<any>;
};
