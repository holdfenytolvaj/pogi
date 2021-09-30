"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAble = void 0;
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
    run(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.query(sql, params, options);
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
            if (this.db.needToFixConnectionForListen()) {
                yield this.db.runRestartConnectionForListen();
            }
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
                    let res = yield connection.query({ text: sql, values: params, rowMode: (options === null || options === void 0 ? void 0 : options.rowMode) ? 'array' : undefined });
                    yield this.checkAndFixOids(connection, res.fields);
                    this.postProcessFields(res.rows, res.fields, logger);
                    return (options === null || options === void 0 ? void 0 : options.rowMode) ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    let res = yield connection.query({ text: sql, values: params, rowMode: (options === null || options === void 0 ? void 0 : options.rowMode) ? 'array' : undefined });
                    yield this.checkAndFixOids(connection, res.fields);
                    connection.off('error', QueryAble.connectionErrorListener);
                    connection.release();
                    connection = null;
                    this.postProcessFields(res.rows, res.fields, logger);
                    return (options === null || options === void 0 ? void 0 : options.rowMode) ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
                }
            }
            catch (e) {
                pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
                if (connection) {
                    try {
                        connection.release();
                    }
                    catch (e) {
                        logger.error('connection error', e.message);
                    }
                }
                throw e;
            }
        });
    }
    queryAsRows(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            return this.internalQuery({ connection, sql, params, logger, rowMode: true });
        });
    }
    queryWithOnCursorCallback(sql, params, options, callback) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.db.needToFixConnectionForListen()) {
                yield this.db.runRestartConnectionForListen();
            }
            let connection = this.db.connection;
            let logger = this.getLogger(true);
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                let queryInternal = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    this.getLogger(false).log(sql, util.inspect(params, false, null), connection.processID);
                    let fieldsToFix;
                    let isFirst = true;
                    let query = new QueryStream(sql, params);
                    let stream = connection.query(query);
                    yield new Promise((resolve, reject) => {
                        query.handleError = (err, connection) => {
                            reject(err);
                        };
                        stream.on('data', (res) => {
                            try {
                                let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                                if (isFirst) {
                                    if (this.hasUnknownOids(fields)) {
                                        fieldsToFix = fields;
                                        stream.destroy();
                                        return;
                                    }
                                    isFirst = false;
                                }
                                this.postProcessFields([res], fields, this.getLogger(false));
                                if (callback(res)) {
                                    stream.destroy();
                                }
                            }
                            catch (e) {
                                reject(e);
                            }
                        });
                        stream.on('close', resolve);
                        stream.on('error', reject);
                    });
                    if (fieldsToFix) {
                        yield this.checkAndFixOids(connection, fieldsToFix);
                        query = new QueryStream(sql, params);
                        stream = connection.query(query);
                        yield new Promise((resolve, reject) => {
                            query.handleError = (err, connection) => {
                                reject(err);
                            };
                            stream.on('data', (res) => {
                                try {
                                    let fields = stream._result && stream._result.fields || stream.cursor._result && stream.cursor._result.fields;
                                    this.postProcessFields([res], fields, this.getLogger(false));
                                    if (callback(res)) {
                                        stream.destroy();
                                    }
                                }
                                catch (e) {
                                    reject(e);
                                }
                            });
                            stream.on('close', resolve);
                            stream.on('error', reject);
                        });
                    }
                });
                if (connection) {
                    yield queryInternal();
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    yield queryInternal();
                    connection.off('error', QueryAble.connectionErrorListener);
                    connection.release();
                    connection = null;
                }
            }
            catch (e) {
                pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
                if (connection) {
                    try {
                        connection.release();
                    }
                    catch (e) {
                        logger.error('connection error', e.message);
                    }
                }
                throw e;
            }
        });
    }
    queryAsStream(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.db.needToFixConnectionForListen()) {
                yield this.db.runRestartConnectionForListen();
            }
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            let pgStream;
            let queriable = this;
            let isFirst = true;
            let convertTypeFilter = through(function (data) {
                try {
                    let fields = pgStream._result && pgStream._result.fields || pgStream.cursor._result && pgStream.cursor._result.fields;
                    if (isFirst) {
                        if (queriable.hasUnknownOids(fields)) {
                            throw new Error('[337] Query returns fields with unknown oid.');
                        }
                        isFirst = false;
                    }
                    queriable.postProcessFields([data], fields, queriable.db.pgdbTypeParsers);
                    this.emit('data', data);
                }
                catch (err) {
                    this.emit('error', err);
                }
            });
            convertTypeFilter.on('error', (e) => {
                if (connection) {
                    try {
                        connection.release();
                    }
                    catch (e) {
                        logger.error('connection error', e.message);
                    }
                }
                connection = null;
                pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
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
                    query.handleError = (err, connection) => {
                        convertTypeFilter.emit('error', err);
                    };
                    pgStream = connection.query(query);
                    return pgStream.pipe(convertTypeFilter);
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    let query = new QueryStream(sql, params);
                    query.handleError = (err, connection) => {
                        convertTypeFilter.emit('error', err);
                    };
                    pgStream = connection.query(query);
                    pgStream.on('close', () => {
                        if (connection) {
                            connection.off('error', QueryAble.connectionErrorListener);
                            connection.release();
                        }
                        connection = null;
                    });
                    pgStream.on('error', (e) => {
                        pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
                        if (connection) {
                            connection.off('error', QueryAble.connectionErrorListener);
                            connection.release();
                        }
                        connection = null;
                    });
                    return pgStream.pipe(convertTypeFilter);
                }
            }
            catch (e) {
                pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
                throw e;
            }
        });
    }
    queryOne(sql, params, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            if (res.length > 1) {
                let logger = (options && options.logger || this.getLogger(false));
                let error = Error('More then one rows exists');
                pgUtils_1.pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
                throw error;
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
                let error = Error('More then one field exists!');
                pgUtils_1.pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
                throw error;
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
    postProcessFields(rows, fields, logger) {
        pgUtils_1.pgUtils.postProcessResult(rows, fields, this.db.pgdbTypeParsers);
        if (this.db.postProcessResult)
            this.db.postProcessResult(rows, fields, logger);
    }
    checkAndFixOids(connection, fields) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (fields) {
                let oidList = fields.map(field => field.dataTypeID);
                return this.db.resetMissingParsers(connection, oidList);
            }
        });
    }
    hasUnknownOids(fields) {
        let oidList = fields.map(field => field.dataTypeID);
        let unknownOids = oidList.filter(oid => !this.db.knownOids[oid]);
        return !!unknownOids.length;
    }
}
exports.QueryAble = QueryAble;
QueryAble.connectionErrorListener = () => { };
//# sourceMappingURL=queryAble.js.map