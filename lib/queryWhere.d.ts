import { FieldType } from "./pgDb";
declare function generateWhere(conditions: Record<string, any>, fieldTypes: {
    [index: string]: FieldType;
}, tableName: string, placeholderOffset?: number, skipUndefined?: boolean): {
    where: string;
    params: Array<any>;
};
export default generateWhere;
