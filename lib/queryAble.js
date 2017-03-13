"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var util = require('util');
var QueryStream = require('pg-query-stream');
const pgUtils_1 = require("./pgUtils");
var through = require('through');
var defaultLogger = {
    log: () => {
    }, error: () => {
    }
};
class QueryAble {
    constructor() {
    }
    setLogger(logger) {
        this.logger = logger;
    }
    getLogger(useConsoleAsDefault = false) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : defaultLogger);
    }
    run(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.query(sql);
        });
    }
    /**
     * Params can be
     * 1) array, then sql should have $1 $2 for placeholders
     * 2) object, then sql should have:
     *    :example -> for params in statements (set/where), will be transformed to $1 $2 ...
     *    :!example -> for DDL names (schema, table, column), will be replaced in the query
     * e.g. query('select * from a.b where id=$1;',['the_stage_is_set']);
     * e.g. query('select * from :!schema.:!table where id=:id;',{schema:'a',table:'b', id:'the_stage_is_set'});
     */
    query(sql, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    logger.log('reused connection', sql, util.inspect(params, false, null), connection.processID);
                    let res = yield connection.query(sql, params);
                    pgUtils_1.pgUtils.postProcessResult(res.rows, res.fields, this.db.pgdbTypeParsers);
                    return res.rows;
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                    try {
                        let res = yield connection.query(sql, params);
                        connection.release();
                        connection = null;
                        pgUtils_1.pgUtils.postProcessResult(res.rows, res.fields, this.db.pgdbTypeParsers);
                        return res.rows;
                    }
                    catch (e) {
                        logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null, e);
                        try {
                            if (connection)
                                connection.release();
                        }
                        catch (e) {
                            logger.error('connection error2', e.message);
                        }
                        connection = null;
                        throw e;
                    }
                }
            }
            catch (e) {
                logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null, e);
                throw e;
            }
        });
    }
    /**
     * If the callback function return true, the connection will be closed.
     */
    queryWithOnCursorCallback(sql, params, options, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                try {
                    if (connection) {
                        this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                        var query = new QueryStream(sql, params);
                        var stream = connection.query(query);
                        yield new Promise((resolve, reject) => {
                            stream.on('data', (res) => {
                                try {
                                    pgUtils_1.pgUtils.postProcessResult([res], stream._result.fields, this.db.pgdbTypeParsers);
                                    if (callback(res)) {
                                        stream.emit('close');
                                    }
                                }
                                catch (e) {
                                    reject(e);
                                }
                            });
                            stream.on('end', resolve);
                            stream.on('error', reject);
                        });
                    }
                    else {
                        connection = yield this.db.pool.connect();
                        this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                        var query = new QueryStream(sql, params);
                        var stream = connection.query(query);
                        yield new Promise((resolve, reject) => {
                            stream.on('data', (res) => {
                                try {
                                    pgUtils_1.pgUtils.postProcessResult([res], stream._result.fields, this.db.pgdbTypeParsers);
                                    if (callback(res)) {
                                        stream.emit('close');
                                    }
                                }
                                catch (e) {
                                    reject(e);
                                }
                            });
                            stream.on('end', resolve);
                            stream.on('error', reject);
                        });
                    }
                }
                finally {
                    try {
                        connection.release();
                    }
                    catch (e) {
                        this.getLogger(true).error('connection error', e.message);
                    }
                }
            }
            catch (e) {
                this.getLogger(true).error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                throw e;
            }
        });
    }
    queryAsStream(sql, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            let pgStream;
            let pgdb = this.db;
            let convertTypeFilter = through(function (data) {
                try {
                    pgUtils_1.pgUtils.postProcessResult([data], pgStream._result.fields, pgdb.pgdbTypeParsers);
                    this.emit('data', data);
                }
                catch (err) {
                    this.emit('error', err);
                }
            });
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    var query = new QueryStream(sql, params);
                    pgStream = connection.query(query);
                    convertTypeFilter.on('error', (e) => {
                        logger.error(e);
                        logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                    });
                    return pgStream.pipe(convertTypeFilter);
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    var query = new QueryStream(sql, params);
                    pgStream = connection.query(query);
                    pgStream.on('end', () => {
                        connection.release();
                        connection = null;
                    });
                    pgStream.on('error', (e) => {
                        connection.release();
                        connection = null;
                        logger.error(e);
                        logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                    });
                    convertTypeFilter.on('close', () => {
                        if (connection)
                            connection.release();
                        connection = null;
                    });
                    convertTypeFilter.on('error', (e) => {
                        if (connection)
                            connection.release();
                        connection = null;
                        logger.error(e);
                        logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                    });
                    return pgStream.pipe(convertTypeFilter);
                }
            }
            catch (e) {
                logger.error(sql, util.inspect(params, false, null), connection ? connection.processID : null);
                throw e;
            }
        });
    }
    /** @return one record's one field */
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
    /** @return one column for the matching records */
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