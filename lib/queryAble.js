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
var util = require('util');
const NAMED_PARAMS_REGEXP = /(?:^|[^:]):(!?[a-zA-Z0-9_]+)/g; // do not convert "::type cast"
class QueryAble {
    constructor() {}
    setLogger(logger) {
        this.logger = logger;
    }
    getLogger(useConsoleAsDefault) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : this.db.defaultLogger);
    }
    run(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.query(sql);
        });
    }
    query(sql, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            try {
                if (params && !Array.isArray(params)) {
                    let p = this.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    let res = yield connection.query(sql, params);
                    return res.rows;
                } else {
                    connection = yield this.db.pool.connect();
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    try {
                        let res = yield connection.query(sql, params);
                        return res.rows;
                    } finally {
                        try {
                            connection.release();
                        } catch (e) {
                            connection = null;
                            this.getLogger(true).error('connection error', e.message);
                        }
                    }
                }
            } catch (e) {
                this.getLogger(true).error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                throw e;
            }
        });
    }
    getOneField(sql, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params);
            let fieldName = Object.keys(res[0])[0];
            if (res.length > 1) {
                throw Error('More then one field exists!');
            }
            return res.length == 1 ? res[0][fieldName] : null;
        });
    }
    getOneColumn(sql, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params);
            let fieldName = Object.keys(res[0])[0];
            return res.map(r => r[fieldName]);
        });
    }
    /**
     * :named -> $1 (not works with DDL (schema, table, column))
     * :!named -> "value" (for DDL (schema, table, column))
     * do not touch ::type cast
     */
    processNamedParams(sql, params) {
        let sql2 = [];
        let params2 = [];
        let p = NAMED_PARAMS_REGEXP.exec(sql);
        let lastIndex = 0;
        while (p) {
            let ddl = false;
            let name = p[1];
            if (name[0] == '!') {
                name = name.slice(1);
                ddl = true;
            }
            if (!(name in params)) {
                throw new Error(`No ${ p[1] } in params (keys: ${ Object.keys(params) })`);
            }
            sql2.push(sql.slice(lastIndex, NAMED_PARAMS_REGEXP.lastIndex - p[1].length - 1));
            if (ddl) {
                sql2.push('"' + ('' + params[name]).replace(/"/g, '""') + '"');
            } else {
                params2.push(params[name]);
                sql2.push('$' + params2.length);
            }
            lastIndex = NAMED_PARAMS_REGEXP.lastIndex;
            p = NAMED_PARAMS_REGEXP.exec(sql);
        }
        sql2.push(sql.substr(lastIndex));
        return {
            sql: sql2.join(''),
            params: params2
        };
    }
    static processQueryOptions(options) {
        let extra = '';
        if (options.groupBy) {
            if (Array.isArray(options.groupBy)) {
                extra += 'GROUP BY ' + options.groupBy.map(f => f.indexOf('"') == -1 ? '"' + f + '"' : f).join(',') + ' ';
            } else {
                extra += 'GROUP BY ' + options.groupBy + ' ';
            }
        }
        if (options.orderBy) {
            if (Array.isArray(options.orderBy)) {
                extra += 'ORDER BY ' + options.orderBy.map(f => f.indexOf('"') == -1 ? '"' + f + '"' : f).join(',') + ' ';
            } else {
                extra += 'ORDER BY ' + options.orderBy + ' ';
            }
        }
        if (options.limit) {
            extra += util.format('LIMIT %d ', options.limit);
        }
        return extra;
    }
}
exports.QueryAble = QueryAble;
//# sourceMappingURL=queryAble.js.map