import {QueryAble} from "./queryAble";
import {PgDb} from "./pgdb";

export class PgSchema extends QueryAble {
    schema:PgSchema;

    constructor(public db:PgDb, public schemaName:string) {
        super();
        this.schema = this;
    }
}
