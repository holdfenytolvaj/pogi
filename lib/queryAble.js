"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAble = void 0;
const tslib_1 = require("tslib");
const pgUtils_1 = require("./pgUtils");
const util = require("util");
const QueryStream = require("pg-query-stream");
const through = require("through");
let defaultLogger = {
    log: () => { },
    error: () => { }
};
class QueryAble {
    setLogger(logger) {
        this.logger = logger;
    }
    getLogger(useConsoleAsDefault = false) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : defaultLogger);
    }
    run(sql, params, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            return this.query(sql, params, options);
        });
    }
    query(sql, params, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            return this.internalQuery({ connection, sql, params, logger });
        });
    }
    internalQuery(options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
                let query = (options === null || options === void 0 ? void 0 : options.rowMode) ? { text: sql, values: params, rowMode: 'array' } : { text: sql, values: params };
                let res;
                if (connection) {
                    logger.log('reused connection', sql, util.inspect(params, false, null), connection.processID);
                    res = yield connection.query(query);
                    yield this.checkAndFixOids(connection, res.fields);
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    try {
                        res = yield connection.query(query);
                        yield this.checkAndFixOids(connection, res.fields);
                    }
                    catch (e) {
                        pgUtils_1.pgUtils.logError(logger, { error: e, sql, params, connection });
                        connection.off('error', QueryAble.connectionErrorListener);
                        connection.release();
                        connection = null;
                        throw e;
                    }
                }
                this.postProcessFields(res.rows, res.fields, logger);
                return (options === null || options === void 0 ? void 0 : options.rowMode) ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
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
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            return this.internalQuery({ connection, sql, params, logger, rowMode: true });
        });
    }
    queryWithOnCursorCallback(sql, params, options, callback) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            if (this.db.needToFixConnectionForListen()) {
                yield this.db.runRestartConnectionForListen();
            }
            let connection = this.db.connection;
            let logger = this.getLogger(true);
            let positionedParams;
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                else {
                    positionedParams = params !== null && params !== void 0 ? params : undefined;
                }
                let queryInternal = () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    this.getLogger(false).log(sql, util.inspect(positionedParams, false, null), connection.processID);
                    let fieldsToFix;
                    let isFirst = true;
                    let query = new QueryStream(sql, positionedParams);
                    let stream = connection.query(query);
                    yield new Promise((resolve, reject) => {
                        query.handleError = reject;
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
                        query = new QueryStream(sql, positionedParams);
                        stream = connection.query(query);
                        yield new Promise((resolve, reject) => {
                            query.handleError = reject;
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
                    logger.log('new connection', sql, util.inspect(positionedParams, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    yield queryInternal();
                    connection.off('error', QueryAble.connectionErrorListener);
                    connection.release();
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
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            if (this.db.needToFixConnectionForListen()) {
                yield this.db.runRestartConnectionForListen();
            }
            let connection = this.db.connection;
            let logger = (options && options.logger || this.getLogger(false));
            let pgStream;
            let queryable = this;
            let isFirst = true;
            let convertTypeFilter = through(function (data) {
                try {
                    let fields = pgStream._result && pgStream._result.fields || pgStream.cursor._result && pgStream.cursor._result.fields;
                    if (isFirst) {
                        if (queryable.hasUnknownOids(fields)) {
                            throw new Error('[337] Query returns fields with unknown oid.');
                        }
                        isFirst = false;
                    }
                    queryable.postProcessFields([data], fields, queryable.db.logger);
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
            let positionedParams;
            try {
                if (params && !Array.isArray(params)) {
                    let p = pgUtils_1.pgUtils.processNamedParams(sql, params);
                    sql = p.sql;
                    params = p.params;
                }
                else {
                    positionedParams = params !== null && params !== void 0 ? params : undefined;
                }
                if (connection) {
                    logger.log(sql, util.inspect(positionedParams, false, null), connection.processID);
                    let query = new QueryStream(sql, positionedParams);
                    query.handleError = (err) => {
                        convertTypeFilter.emit('error', err);
                    };
                    pgStream = connection.query(query);
                    return pgStream.pipe(convertTypeFilter);
                }
                else {
                    connection = yield this.db.pool.connect();
                    logger.log('new connection', sql, util.inspect(positionedParams, false, null), connection.processID);
                    connection.on('error', QueryAble.connectionErrorListener);
                    let query = new QueryStream(sql, positionedParams);
                    query.handleError = (err, _connection) => {
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
                        pgUtils_1.pgUtils.logError(logger, { error: e, sql, params: positionedParams, connection });
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
                pgUtils_1.pgUtils.logError(logger, { error: e, sql, params: positionedParams, connection });
                throw e;
            }
        });
    }
    queryOne(sql, params, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            let res = yield this.query(sql, params, options);
            return res[0];
        });
    }
    queryOneField(sql, params, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
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