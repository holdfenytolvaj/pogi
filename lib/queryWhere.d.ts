import { FieldType } from "./pgdb";
declare function generateWhere(conditions: any, fieldTypes: {
    [index: string]: FieldType;
}, tableName: string, placeholderOffset?: number): {
    where: string;
    params: Array<any>;
};
export default generateWhere;
