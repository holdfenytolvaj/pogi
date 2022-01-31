import { QueryAble } from "./queryAble";
import { PgDb, PgTable } from ".";
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
