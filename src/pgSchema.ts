import { QueryAble } from "./queryAble";
import { IPgDb } from "./pgDbInterface";
import { IPgTable } from "./pgTableInterface";
import { IPgSchema } from "./pgSchemaInterface";

export class PgSchema extends QueryAble implements IPgSchema {
    schema: IPgSchema;
    tables: { [name: string]: IPgTable<any> } = {};
    fn: { [name: string]: (...args: any[]) => any } = {};
    [name: string]: any | IPgTable<any>;

    constructor(public db: IPgDb, public schemaName: string) {
        super();
        this.schema = this;
    }
}
