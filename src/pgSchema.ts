import {QueryAble} from "./queryAble";
import {PgDb} from "./pgDb";
import {PgTable} from "./pgTable";

export class PgSchema extends QueryAble {
    schema:PgSchema;
    tables:{[name:string]:PgTable<any>} = {};
    [name:string]:any|PgTable<any>;

    constructor(public db:PgDb, public schemaName:string) {
        super();
        this.schema = this;
    }
}
