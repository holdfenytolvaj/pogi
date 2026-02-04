import { PgDb, PgTable } from "./index.js";
import { QueryAble } from "./queryAble.js";
export declare class PgSchema extends QueryAble {
    db: PgDb;
    schemaName: string;
    schema: PgSchema;
    tables: {
        [name: string]: PgTable<any>;
    };
    fn: {
        [name: string]: (...args: any[]) => any;
    };
    [name: string]: any | PgTable<any>;
    constructor(db: PgDb, schemaName: string);
}
