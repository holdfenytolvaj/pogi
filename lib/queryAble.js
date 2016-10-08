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
var QueryStream = require('pg-query-stream');
const pgUtils_1 = require("./pgUtils");
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
    query(sql, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = options && options.logger || this.getLogger(false);
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    let res = yield connection.query(sql, params);
                    return res.rows;
                } else {
                    connection = yield this.db.pool.connect();
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    try {
                        let res = yield connection.query(sql, params);
                        return res.rows;
                    } finally {
                        try {
                            connection.release();
                        } catch (e) {
                            connection = null;
                            logger.error('connection error', e.message);
                        }
                    }
                }
            } catch (e) {
                logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                throw e;
            }
        });
    }
    queryAsStream(sql, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    var query = new QueryStream(sql, params);
                    var stream = connection.query(query);
                    return stream;
                } else {
                    connection = yield this.db.pool.connect();
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    try {
                        var query = new QueryStream(sql, params);
                        var stream = connection.query(query);
                        stream.on('end', () => connection.release());
                        return stream;
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
    queryOneField(sql, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            let fieldName = Object.keys(res[0])[0];
            if (res.length > 1) {
                throw Error('More then one field exists!');
            }
            return res.length == 1 ? res[0][fieldName] : null;
        });
    }
    queryOneColumn(sql, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            let fieldName = Object.keys(res[0])[0];
            return res.map(r => r[fieldName]);
        });
    }
}
exports.QueryAble = QueryAble;
//# sourceMappingURL=queryAble.js.map