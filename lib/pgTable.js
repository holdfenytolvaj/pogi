"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const queryAble_1 = require("./queryAble");
const pgdb_1 = require("./pgdb");
const queryWhere_1 = require("./queryWhere");
var util = require('util');
var _ = require('lodash');
class PgTable extends queryAble_1.QueryAble {
    constructor(schema, desc, fieldType = {}) {
        super();
        this.schema = schema;
        this.desc = desc;
        this.db = schema.db;
        this.qualifiedName = util.format('"%s"."%s"', desc.schema, desc.name);
        this.fieldType = fieldType;
    }
    toString() {
        return this.qualifiedName;
    }
    insert(records, returnResult = true) {
        return __awaiter(this, void 0, void 0, function* () {
            var returnSingle = false;
            if (!records) {
                throw new Error("insert should be called with data");
            }
            else if (!Array.isArray(records)) {
                returnSingle = true;
                records = [records];
            }
            else if (records.length === 0) {
                return []; // just return empty arrays so bulk inserting variable-length lists is more friendly
            }
            let delimitedColumnNames = _.map(_.keys(records[0]), (fieldName) => util.format('"%s"', fieldName));
            let sql = util.format("INSERT INTO %s (%s) VALUES\n", this.qualifiedName, delimitedColumnNames.join(", "));
            let parameters = [];
            let values = [];
            for (var i = 0, seed = 0; i < records.length; ++i) {
                values.push(util.format('(%s)', _.map(records[i], () => "$" + (++seed)).join(', ')));
                _.forEach(records[i], (param, fieldName) => {
                    parameters.push(this.transformInsertUpdateParams(param, this.fieldType[fieldName]));
                });
            }
            sql += values.join(",\n");
            if (returnResult) {
                sql += " RETURNING *";
            }
            let result = yield this.query(sql, parameters);
            if (!returnResult) {
                return;
            }
            if (returnSingle) {
                return result[0];
            }
            else {
                return result;
            }
        });
    }
    ;
    /**
     * NOTE-DATE: there are 2 approaches to keep tz (the time correctly):
     *    1) use Date.toISOString() function, but then the $x placeholder should be TIMESTAMP WITH TIME ZONE $x
     *    2) use Date, and then no need to change the placeholder $x
     *    lets use 2)
     */
    transformInsertUpdateParams(param, fieldType) {
        return (param != null && fieldType == pgdb_1.FieldType.JSON) ? JSON.stringify(param) :
            (param != null && fieldType == pgdb_1.FieldType.TIME && !(param instanceof Date)) ? new Date(param) : param;
    }
    getUpdateQuery(conditions, fields) {
        var hasConditions = true;
        if (_.isEmpty(fields)) {
            throw new Error('Missing fields for update');
        }
        let parameters = [];
        let f = [];
        let seed = 0;
        _.each(fields, (value, fieldName) => {
            if (value === undefined)
                return;
            f.push(util.format('"%s" = $%s', fieldName, (++seed)));
            parameters.push(this.transformInsertUpdateParams(value, this.fieldType[fieldName]));
        });
        let sql = util.format("UPDATE %s SET %s", this.qualifiedName, f.join(', '));
        if (!hasConditions || !_.isEmpty(conditions)) {
            var parsedWhere = queryWhere_1.default(conditions, this.fieldType, this.qualifiedName, parameters.length);
            sql += parsedWhere.where;
        }
        parameters = parameters.concat(_.flatten(_.values(conditions).filter(v => v !== undefined)));
        return { sql, parameters };
    }
    updateOne(conditions, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            let affected = yield this.update(conditions, fields);
            if (affected > 1) {
                throw new Error('More then one record has been updated!');
            }
            return affected;
        });
    }
    updateAndGetOne(conditions, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.updateAndGet(conditions, fields);
            if (result.length > 1) {
                throw new Error('More then one record has been updated!');
            }
            return result[0];
        });
    }
    update(conditions, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getUpdateQuery(conditions, fields);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters);
            return +res[0].sum;
        });
    }
    ;
    updateAndGet(conditions, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getUpdateQuery(conditions, fields);
            sql += " RETURNING *";
            return this.query(sql, parameters);
        });
    }
    ;
    getDeleteQuery(conditions) {
        let sql = util.format("DELETE FROM %s ", this.qualifiedName);
        var parsedWhere;
        if (!_.isEmpty(conditions)) {
            parsedWhere = queryWhere_1.default(conditions, this.fieldType, this.qualifiedName);
            sql += parsedWhere.where;
        }
        return { sql, parameters: parsedWhere.params || [] };
    }
    deleteAll() {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = util.format("DELETE FROM %s ", this.qualifiedName);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql);
            return +res[0].sum;
        });
    }
    delete(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getDeleteQuery(conditions);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters);
            return +res[0].sum;
        });
    }
    deleteAndGet(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getDeleteQuery(conditions);
            sql += " RETURNING *";
            return this.query(sql, parameters);
        });
    }
    deleteOneAndGet(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.deleteAndGet(conditions);
            if (result.length > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return result[0];
        });
    }
    deleteOne(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let affected = yield this.delete(conditions);
            if (affected > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return affected;
        });
    }
    find(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let where = _.isEmpty(conditions) ? { where: " ", params: null } : queryWhere_1.default(conditions, this.fieldType, this.qualifiedName);
            let sql = "SELECT * FROM " + this.qualifiedName + (where.where ? where.where : '');
            if (options) {
                if (options.fields) {
                    if (Array.isArray(options.fields)) {
                        sql = 'SELECT ' + options.fields.map(f => f.indexOf('"') == -1 ? '"' + f + '"' : f).join(',');
                    }
                    else {
                        sql = 'SELECT ' + options.fields;
                    }
                    sql += ' FROM ' + this.qualifiedName + where.where;
                }
                sql += queryAble_1.QueryAble.processQueryOptions(options);
            }
            return this.query(sql, where.params);
        });
    }
    findWhere(where, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = "SELECT * FROM " + this.qualifiedName + ' WHERE ' + where;
            return this.query(sql, params);
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = "SELECT * FROM " + this.qualifiedName;
            return this.query(sql);
        });
    }
    findOne(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.find(conditions);
            if (res.length > 1) {
                throw new Error('More then one rows exists');
            }
            return res[0];
        });
    }
    findFirst(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.find(conditions, { limit: 1 });
            return res[0];
        });
    }
    count(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            var where = _.isEmpty(conditions) ? { where: " ", params: null } : queryWhere_1.default(conditions, this.fieldType, this.qualifiedName);
            var sql = "SELECT COUNT(*) c FROM " + this.qualifiedName + where.where;
            return (yield this.getOneField(sql, where.params));
        });
    }
    findOneFieldOnly(conditions, field) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.findOne(conditions);
            return res ? res[field] : null;
        });
    }
}
exports.PgTable = PgTable;
//# sourceMappingURL=pgTable.js.map