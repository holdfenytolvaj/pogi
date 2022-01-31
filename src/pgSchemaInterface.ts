import { IPgDb } from "./pgDbInterface";
import { IPgTable } from "./pgTableInterface";
import { IQueryAble } from "./queryAbleInterface";

export interface IPgSchema extends IQueryAble {
    schemaName: string;

    tables: { [name: string]: IPgTable<any> };
    fn: { [name: string]: (...args: any[]) => any };
    [name: string]: any | IPgTable<any>;
    
}
