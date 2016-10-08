"use strict";

var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator.throw(value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : new P(function (resolve) {
                resolve(result.value);
            }).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const queryAble_1 = require("./queryAble");
const queryWhere_1 = require("./queryWhere");
const pgUtils_1 = require("./pgUtils");
var util = require('util');
var _ = require('lodash');
class PgTable extends queryAble_1.QueryAble {
    constructor(schema, desc) {
        let fieldTypes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

        super();
        this.schema = schema;
        this.desc = desc;
        this.db = schema.db;
        this.qualifiedName = util.format('"%s"."%s"', desc.schema, desc.name);
        this.fieldTypes = fieldTypes;
    }
    toString() {
        return this.qualifiedName;
    }
    insert(records, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var returnSingle = false;
            options = options || {};
            if (!records) {
                throw new Error("insert should be called with data");
            } else if (!Array.isArray(records)) {
                returnSingle = true;
                records = [records];
            } else if (records.length === 0) {
                return []; // just return empty arrays so bulk inserting variable-length lists is more friendly
            }
            let delimitedColumnNames = Object.keys(records[0]).map(pgUtils_1.pgUtils.quoteField);
            let sql = util.format("INSERT INTO %s (%s) VALUES\n", this.qualifiedName, delimitedColumnNames.join(", "));
            let parameters = [];
            let values = [];
            for (var i = 0, seed = 0; i < records.length; ++i) {
                values.push(util.format('(%s)', _.map(records[i], () => "$" + ++seed).join(', ')));
                _.forEach(records[i], (param, fieldName) => {
                    parameters.push(pgUtils_1.pgUtils.transformInsertUpdateParams(param, this.fieldTypes[fieldName]));
                });
            }
            sql += values.join(",\n");
            if (options.return == null || options.return == true) {
                if (Array.isArray(options.return)) {
                    sql += " RETURNING " + options.return.map(pgUtils_1.pgUtils.quoteField).join(',');
                } else {
                    sql += " RETURNING *";
                }
            }
            let result = yield this.query(sql, parameters, { logger: options.logger });
            if (options.return === false) {
                return;
            }
            if (returnSingle) {
                return result[0];
            } else {
                return result;
            }
        });
    }

    updateOne(conditions, fields, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let affected = yield this.update(conditions, fields, options);
            if (affected > 1) {
                throw new Error('More then one record has been updated!');
            }
            return affected;
        });
    }
    updateAndGetOne(conditions, fields, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.updateAndGet(conditions, fields, options);
            if (result.length > 1) {
                throw new Error('More then one record has been updated!');
            }
            return result[0];
        });
    }
    update(conditions, fields, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _getUpdateQuery = this.getUpdateQuery(conditions, fields);

            let sql = _getUpdateQuery.sql;
            let parameters = _getUpdateQuery.parameters;

            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters, options);
            return res[0].sum;
        });
    }

    updateAndGet(conditions, fields, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _getUpdateQuery2 = this.getUpdateQuery(conditions, fields);

            let sql = _getUpdateQuery2.sql;
            let parameters = _getUpdateQuery2.parameters;

            sql += " RETURNING " + (options && options.return ? options.return.map(pgUtils_1.pgUtils.quoteField).join(',') : '*');
            return this.query(sql, parameters, options);
        });
    }

    delete(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _getDeleteQuery = this.getDeleteQuery(conditions);

            let sql = _getDeleteQuery.sql;
            let parameters = _getDeleteQuery.parameters;

            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters, options);
            return res[0].sum;
        });
    }
    deleteOne(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let affected = yield this.delete(conditions, options);
            if (affected > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return affected;
        });
    }
    deleteAndGet(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _getDeleteQuery2 = this.getDeleteQuery(conditions);

            let sql = _getDeleteQuery2.sql;
            let parameters = _getDeleteQuery2.parameters;

            sql += " RETURNING " + options && options.return ? options.return.map(pgUtils_1.pgUtils.quoteField).join(',') : '*';
            return this.query(sql, parameters);
        });
    }
    deleteAndGetOne(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield this.deleteAndGet(conditions, options);
            if (result.length > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return result[0];
        });
    }
    deleteAll(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = util.format("DELETE FROM %s ", this.qualifiedName);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, { logger: options.logger });
            return res[0].sum;
        });
    }
    find(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let where = _.isEmpty(conditions) ? { where: " ", params: null } : queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName);
            let sql = `SELECT ${ pgUtils_1.pgUtils.processQueryFields(options) } FROM ${ this.qualifiedName } ${ where.where } ${ pgUtils_1.pgUtils.processQueryOptions(options) }`;
            return this.query(sql, where.params, options);
        });
    }
    findWhere(where, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = `SELECT ${ pgUtils_1.pgUtils.processQueryFields(options) } FROM ${ this.qualifiedName } WHERE ${ where } ${ pgUtils_1.pgUtils.processQueryOptions(options) }`;
            return this.query(sql, params, options);
        });
    }
    findAll(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let sql = `SELECT ${ pgUtils_1.pgUtils.processQueryFields(options) } FROM ${ this.qualifiedName } ${ pgUtils_1.pgUtils.processQueryOptions(options) }`;
            return this.query(sql, null, options);
        });
    }
    findOne(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.find(conditions, options);
            if (res.length > 1) {
                throw new Error('More then one rows exists');
            }
            return res[0];
        });
    }
    findFirst(conditions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.limit = 1;
            let res = yield this.find(conditions, options);
            return res[0];
        });
    }
    count(conditions) {
        return __awaiter(this, void 0, void 0, function* () {
            var where = _.isEmpty(conditions) ? { where: " ", params: null } : queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName);
            var sql = `SELECT COUNT(*) c FROM ${ this.qualifiedName } ${ where.where }`;
            return yield this.queryOneField(sql, where.params);
        });
    }
    findOneFieldOnly(conditions, field, options) {
        return __awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.fields = [field];
            let res = yield this.findOne(conditions, options);
            return res ? res[field] : null;
        });
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
            if (value === undefined) return;
            f.push(util.format('%s = $%s', pgUtils_1.pgUtils.quoteField(fieldName), ++seed));
            parameters.push(pgUtils_1.pgUtils.transformInsertUpdateParams(value, this.fieldTypes[fieldName]));
        });
        let sql = util.format("UPDATE %s SET %s", this.qualifiedName, f.join(', '));
        if (!hasConditions || !_.isEmpty(conditions)) {
            var parsedWhere = queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName, parameters.length);
            sql += parsedWhere.where;
        }
        parameters = parameters.concat(_.flatten(_.values(conditions).filter(v => v !== undefined)));
        return { sql, parameters };
    }
    getDeleteQuery(conditions) {
        let sql = util.format("DELETE FROM %s ", this.qualifiedName);
        var parsedWhere;
        if (!_.isEmpty(conditions)) {
            parsedWhere = queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName);
            sql += parsedWhere.where;
        }
        return { sql, parameters: parsedWhere && parsedWhere.params || [] };
    }
}
exports.PgTable = PgTable;
//# sourceMappingURL=pgTable.js.map