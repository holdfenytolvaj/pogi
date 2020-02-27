"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pgUtils_1 = require("./pgUtils");
const util = require('util');
const QueryStream = require('pg-query-stream');
const through = require('through');
let defaultLogger = {
    log: () => { },
    error: () => { }
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.query(sql);
        });
    }
    query(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            return this.internalQuery({ connection, sql, params, logger });
        });
    }
    internalQuery(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let { connection, sql, params, logger } = options;
            logger = logger || this.getLogger(false);
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
                    if (this.db.postProcessResult)
                        this.db.postProcessResult(res.rows, res.fields, logger);
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
                        if (this.db.postProcessResult)
                            this.db.postProcessResult(res.rows, res.fields, logger);
                        return res.rows;
                    }
                    catch (e) {
                        logger.error(e);
                        pgUtils_1.pgUtils.logError(logger, sql, params, connection);
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
                pgUtils_1.pgUtils.logError(logger, sql, params, connection);
                throw e;
            }
        });
    }
    queryWithOnCursorCallback(sql, params, options, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    let query = new QueryStream(sql, params);
                    let stream = connection.query(query);
                    yield new Promise((resolve, reject) => {
                        stream.on('data', (res) => {
                            try {
                                let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                                pgUtils_1.pgUtils.postProcessResult([res], fields, this.db.pgdbTypeParsers);
                                if (this.db.postProcessResult)
                                    this.db.postProcessResult([res], fields, this.getLogger(false));
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
                    try {
                        connection = yield this.db.pool.connect();
                        this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                        let query = new QueryStream(sql, params);
                        let stream = connection.query(query);
                        yield new Promise((resolve, reject) => {
                            stream.on('data', (res) => {
                                try {
                                    let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                                    pgUtils_1.pgUtils.postProcessResult([res], fields, this.db.pgdbTypeParsers);
                                    if (this.db.postProcessResult)
                                        this.db.postProcessResult([res], fields, this.getLogger(false));
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
                    finally {
                        try {
                            connection.release();
                        }
                        catch (e) {
                            this.getLogger(true).error('connection error', e.message);
                        }
                    }
                }
            }
            catch (e) {
                let logger = this.getLogger(true);
                pgUtils_1.pgUtils.logError(logger, sql, params, connection);
                throw e;
            }
        });
    }
    queryAsStream(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            let pgStream;
            let pgdb = this.db;
            let convertTypeFilter = through(function (data) {
                try {
                    let fields = pgStream._result && pgStream._result.fields || pgStream.cursor._result && pgStream.cursor._result.fields;
                    pgUtils_1.pgUtils.postProcessResult([data], fields, pgdb.pgdbTypeParsers);
                    if (pgdb.postProcessResult)
                        pgdb.postProcessResult([data], fields, logger);
                    this.emit('data', data);
                }
                catch (err) {
                    this.emit('error', err);
                }
            });
            convertTypeFilter.on('error', (e) => {
                logger.error(e);
                pgUtils_1.pgUtils.logError(logger, sql, params, connection);
            });
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                if (connection) {
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    let query = new QueryStream(sql, params);
                    pgStream = connection.query(query);
                    return pgStream.pipe(convertTypeFilter);
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log(sql, util.inspect(params, false, null), connection.processID);
                    let query = new QueryStream(sql, params);
                    pgStream = connection.query(query);
                    pgStream.on('close', () => {
                        if (connection)
                            connection.release();
                        connection = null;
                    });
                    pgStream.on('error', (e) => {
                        if (connection)
                            connection.release();
                        connection = null;
                        logger.error(e);
                        pgUtils_1.pgUtils.logError(logger, sql, params, connection);
                    });
                    return pgStream.pipe(convertTypeFilter);
                }
            }
            catch (e) {
                pgUtils_1.pgUtils.logError(logger, sql, params, connection);
                throw e;
            }
        });
    }
    queryOne(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            if (res.length > 1) {
                let logger = (options && options.logger || this.getLogger(false));
                pgUtils_1.pgUtils.logError(logger, sql, params, this.db.connection);
                throw Error('More then one rows exists');
            }
            return res[0];
        });
    }
    queryFirst(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            return res[0];
        });
    }
    queryOneField(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            if (!res.length) {
                return null;
            }
            let fieldName = Object.keys(res[0])[0];
            if (res.length > 1) {
                let logger = (options && options.logger || this.getLogger(false));
                pgUtils_1.pgUtils.logError(logger, sql, params, this.db.connection);
                throw Error('More then one field exists!');
            }
            return res.length == 1 ? res[0][fieldName] : null;
        });
    }
    queryOneColumn(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            if (!res.length) {
                return [];
            }
            let fieldName = Object.keys(res[0])[0];
            return res.map(r => r[fieldName]);
        });
    }
}
exports.QueryAble = QueryAble;
//# sourceMappingURL=queryAble.js.map