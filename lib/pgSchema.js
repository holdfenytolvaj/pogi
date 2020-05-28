"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgSchema = void 0;
const queryAble_1 = require("./queryAble");
class PgSchema extends queryAble_1.QueryAble {
    constructor(db, schemaName) {
        super();
        this.db = db;
        this.schemaName = schemaName;
        this.tables = {};
        this.fn = {};
        this.schema = this;
    }
}
exports.PgSchema = PgSchema;
//# sourceMappingURL=pgSchema.js.map