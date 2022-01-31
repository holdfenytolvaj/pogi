"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgTable = void 0;
const tslib_1 = require("tslib");
const _ = require("lodash");
const pgUtils_1 = require("./pgUtils");
const queryAble_1 = require("./queryAble");
const queryWhere_1 = require("./queryWhere");
class PgTable extends queryAble_1.QueryAble {
    constructor(schema, desc, fieldTypes = {}) {
        super();
        this.schema = schema;
        this.desc = desc;
        this.db = schema.db;
        this.qualifiedName = `${pgUtils_1.pgUtils.quoteFieldName(desc.schema)}.${pgUtils_1.pgUtils.quoteFieldName(desc.name)}`;
        this.pkey = desc.pkey || desc.name + "_pkey";
        this.fieldTypes = fieldTypes;
        return this;
    }
    toString() {
        return this.qualifiedName;
    }
    insert(records, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            if (!records) {
                throw new Error("insert should be called with data");
            }
            else if (!Array.isArray(records)) {
                records = [records];
            }
            else if (records.length === 0) {
                return 0;
            }
            let { sql, parameters } = this.getInsertQuery(records);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let result = yield this.query(sql, parameters, { logger: options.logger });
            return result[0].sum;
        });
    }
    insertAndGet(records, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let returnSingle = false;
            options = options || {};
            if (!records) {
                throw new Error("insert should be called with data");
            }
            else if (!Array.isArray(records)) {
                returnSingle = true;
                records = [records];
            }
            else if (records.length === 0) {
                return [];
            }
            let { sql, parameters } = this.getInsertQuery(records);
            sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils_1.pgUtils.quoteFieldName).join(',') : '*');
            let result = yield this.query(sql, parameters, { logger: options.logger });
            if (options.return && options.return.length == 0) {
                return new Array(returnSingle ? 1 : records.length).fill({});
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
    updateOne(conditions, fields, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let affected = yield this.update(conditions, fields, options);
            if (affected > 1) {
                throw new Error('More then one record has been updated!');
            }
            return affected;
        });
    }
    updateAndGetOne(conditions, fields, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let result = yield this.updateAndGet(conditions, fields, options);
            if (result.length > 1) {
                throw new Error('More then one record has been updated!');
            }
            return result[0];
        });
    }
    update(conditions, fields, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getUpdateQuery(conditions, fields, options);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters, options);
            return res[0].sum;
        });
    }
    ;
    updateAndGet(conditions, fields, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getUpdateQuery(conditions, fields, options);
            sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils_1.pgUtils.quoteFieldName).join(',') : '*');
            return this.query(sql, parameters, options);
        });
    }
    ;
    upsert(record, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            if (!record) {
                throw new Error("insert should be called with data");
            }
            let { sql, parameters } = this.getUpsertQuery(record, options);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let result = yield this.query(sql, parameters, { logger: options.logger });
            return result[0].sum;
        });
    }
    ;
    upsertAndGet(record, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            if (!record) {
                throw new Error("insert should be called with data");
            }
            let { sql, parameters } = this.getUpsertQuery(record, options);
            sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils_1.pgUtils.quoteFieldName).join(',') : '*');
            let result = yield this.query(sql, parameters, { logger: options.logger });
            if (options.return && options.return.length == 0) {
                return {};
            }
            return result[0];
        });
    }
    ;
    delete(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { sql, parameters } = this.getDeleteQuery(conditions, options);
            sql = "WITH __RESULT as ( " + sql + " RETURNING 1) SELECT SUM(1) FROM __RESULT";
            let res = yield this.query(sql, parameters, options);
            return res[0].sum;
        });
    }
    deleteOne(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let affected = yield this.delete(conditions, options);
            if (affected > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return affected;
        });
    }
    deleteAndGet(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            let { sql, parameters } = this.getDeleteQuery(conditions, options);
            sql += " RETURNING " + (options && options.return && Array.isArray(options.return) ? options.return.map(pgUtils_1.pgUtils.quoteFieldName).join(',') : '*');
            return this.query(sql, parameters);
        });
    }
    deleteAndGetOne(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let result = yield this.deleteAndGet(conditions, options);
            if (result.length > 1) {
                throw new Error('More then one record has been deleted!');
            }
            return result[0];
        });
    }
    truncate(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let sql = `TRUNCATE ${this.qualifiedName}`;
            if (options && options.restartIdentity) {
                sql += ' RESTART IDENTITY';
            }
            if (options && options.cascade) {
                sql += ' CASCADE';
            }
            yield this.query(sql, undefined, options);
        });
    }
    find(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined && ['all', 'select'].includes(this.db.config.skipUndefined));
            let where = _.isEmpty(conditions) ? {
                where: "",
                params: undefined
            } : queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
            let sql = `SELECT ${pgUtils_1.pgUtils.processQueryFields(options)} FROM ${this.qualifiedName} ${where.where} ${pgUtils_1.pgUtils.processQueryOptions(options, this)}`;
            return options.stream ? this.queryAsStream(sql, where.params, options) : this.query(sql, where.params, options);
        });
    }
    findWhere(where, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            let sql = `SELECT ${pgUtils_1.pgUtils.processQueryFields(options)} FROM ${this.qualifiedName} WHERE ${where} ${pgUtils_1.pgUtils.processQueryOptions(options, this)}`;
            return options.stream ? this.queryAsStream(sql, params, options) : this.query(sql, params, options);
        });
    }
    findAll(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            let sql = `SELECT ${pgUtils_1.pgUtils.processQueryFields(options)} FROM ${this.qualifiedName} ${pgUtils_1.pgUtils.processQueryOptions(options, this)}`;
            return options.stream ? this.queryAsStream(sql, undefined, options) : this.query(sql, null, options);
        });
    }
    findOne(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.find(conditions, options);
            if (res.length > 1) {
                let logger = (options && options.logger || this.getLogger(false));
                let error = new Error('More then one rows exists');
                pgUtils_1.pgUtils.logError(logger, { error, sql: this.qualifiedName, params: conditions, connection: this.db.connection });
                throw error;
            }
            return res[0];
        });
    }
    findFirst(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.limit = 1;
            let res = yield this.find(conditions, options);
            return res[0];
        });
    }
    count(conditions, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined && ['all', 'select'].includes(this.db.config.skipUndefined));
            let where = _.isEmpty(conditions) ? {
                where: " ",
                params: undefined
            } : queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
            let sql = `SELECT COUNT(*) c FROM ${this.qualifiedName} ${where.where}`;
            return (yield this.queryOneField(sql, where.params));
        });
    }
    findOneFieldOnly(conditions, field, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.fields = [field];
            let res = yield this.findOne(conditions, options);
            return res ? res[field] : null;
        });
    }
    getInsertQuery(records) {
        let columnsMap = {};
        records.forEach(rec => {
            for (let field in rec) {
                columnsMap[field] = true;
            }
        });
        let columns = Object.keys(columnsMap);
        let sql = `INSERT INTO ${this.qualifiedName} (${columns.map(pgUtils_1.pgUtils.quoteFieldName).join(", ")}) VALUES\n`;
        let parameters = [];
        let placeholders = [];
        for (let i = 0, seed = 0; i < records.length; i++) {
            placeholders.push('(' + columns.map(c => "$" + (++seed)).join(', ') + ')');
            parameters.push(...columns.map(c => pgUtils_1.pgUtils.transformInsertUpdateParams(records[i][c], this.fieldTypes[c])));
        }
        sql += placeholders.join(",\n");
        return { sql, parameters };
    }
    getUpdateSetSnippet(fields, parameters) {
        let params = parameters || [];
        let f = [];
        let seed = params.length;
        _.each(fields, (value, fieldName) => {
            if (value === undefined)
                return;
            f.push(`${pgUtils_1.pgUtils.quoteFieldName(fieldName)} = $${(++seed)}`);
            params.push(pgUtils_1.pgUtils.transformInsertUpdateParams(value, this.fieldTypes[fieldName]));
        });
        return { snippet: f.join(', '), parameters: params };
    }
    getUpdateQuery(conditions, fields, options) {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined === 'all');
        let hasConditions = true;
        if (_.isEmpty(fields)) {
            throw new Error('Missing fields for update');
        }
        let { snippet, parameters } = this.getUpdateSetSnippet(fields);
        let sql = `UPDATE ${this.qualifiedName} SET ${snippet}`;
        if (!hasConditions || !_.isEmpty(conditions)) {
            let parsedWhere = queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName, parameters.length, options.skipUndefined);
            sql += parsedWhere.where;
            parameters = parameters.concat(parsedWhere.params);
        }
        return { sql, parameters };
    }
    getUpsertQuery(record, options) {
        options = options || {};
        if (_.isEmpty(record)) {
            throw new Error('Missing fields for upsert');
        }
        let insert = this.getInsertQuery([record]);
        let { snippet, parameters } = this.getUpdateSetSnippet(record, insert.parameters);
        let sql = insert.sql;
        if (options.columns) {
            sql += ` ON CONFLICT (${options.columns.map(c => pgUtils_1.pgUtils.quoteFieldName(c)).join(', ')}) DO UPDATE SET ${snippet}`;
        }
        else {
            let constraint = pgUtils_1.pgUtils.quoteFieldName(options.constraint || this.pkey);
            sql += ` ON CONFLICT ON CONSTRAINT ${constraint} DO UPDATE SET ${snippet}`;
        }
        return { sql, parameters };
    }
    getDeleteQuery(conditions, options) {
        options = options || {};
        options.skipUndefined = options.skipUndefined === true || (options.skipUndefined === undefined && this.db.config.skipUndefined === 'all');
        let sql = `DELETE FROM ${this.qualifiedName} `;
        let parsedWhere;
        if (!_.isEmpty(conditions)) {
            parsedWhere = queryWhere_1.default(conditions, this.fieldTypes, this.qualifiedName, 0, options.skipUndefined);
            sql += parsedWhere.where;
        }
        return { sql, parameters: parsedWhere && parsedWhere.params || [] };
    }
}
exports.PgTable = PgTable;
//# sourceMappingURL=pgTable.js.map