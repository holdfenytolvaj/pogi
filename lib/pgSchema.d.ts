import { QueryAble } from "./queryAble";
import { PgDb } from "./pgDb";
import { PgTable } from "./pgTable";
export declare class PgSchema extends QueryAble {
    db: PgDb;
    schemaName: string;
    schema: PgSchema;
    tables: {
        [name: string]: PgTable;
    };
    [name: string]: any | PgTable;
    constructor(db: PgDb, schemaName: string);
}
