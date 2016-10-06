import { QueryAble } from "./queryAble";
import { PgDb } from "./pgdb";
export declare class PgSchema extends QueryAble {
    db: PgDb;
    schemaName: string;
    schema: PgSchema;
    constructor(db: PgDb, schemaName: string);
}
