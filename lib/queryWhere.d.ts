import { FieldType } from "./pgDb";
/** public */
declare function generateWhere(conditions: any, fieldTypes: {
    [index: string]: FieldType;
}, tableName: string, placeholderOffset: number, skipUndefined: any): {
    where: string;
    params: Array<any>;
};
export default generateWhere;
