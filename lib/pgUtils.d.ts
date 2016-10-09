import { QueryOptions, ResultFieldType } from "./queryAble";
import { FieldType } from "./pgDb";
export declare var pgUtils: {
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
};
