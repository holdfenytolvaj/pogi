import { QueryAble } from "./queryAble";
import { IPgDb } from "./pgDbInterface";
import { IPgTable } from "./pgTableInterface";
import { IPgSchema } from "./pgSchemaInterface";
export declare class PgSchema extends QueryAble implements IPgSchema {
    db: IPgDb;
    schemaName: string;
    schema: IPgSchema;
    tables: {
        [name: string]: IPgTable<any>;
    };
    fn: {
        [name: string]: (...args: any[]) => any;
    };
    [name: string]: any | IPgTable<any>;
    constructor(db: IPgDb, schemaName: string);
}
