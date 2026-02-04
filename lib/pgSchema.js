import { QueryAble } from "./queryAble.js";
export class PgSchema extends QueryAble {
    db;
    schemaName;
    schema;
    tables = {};
    fn = {};
    constructor(db, schemaName) {
        super();
        this.db = db;
        this.schemaName = schemaName;
        this.schema = this;
    }
}
//# sourceMappingURL=pgSchema.js.map