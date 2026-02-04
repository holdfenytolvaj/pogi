import { Transform } from "node:stream";
import util from 'node:util';
import QueryStream from "pg-query-stream";
import { pgUtils } from "./pgUtils.js";
let defaultLogger = {
    log: () => { },
    error: () => { }
};
export class QueryAble {
    db;
    schema;
    logger;
    static connectionErrorListener = () => { };
    setLogger(logger) {
        this.logger = logger;
    }
    getLogger(useConsoleAsDefault = false) {
        return this.logger || this.schema && this.schema.logger || this.db.logger || (useConsoleAsDefault ? console : defaultLogger);
    }
    async run(sql, params, options) {
        return this.query(sql, params, options);
    }
    async query(sql, params, options) {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        return this.internalQuery({ connection, sql, params, logger });
    }
    async internalQuery(options) {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let { connection, sql, params, logger } = options;
        logger = logger || this.getLogger(false);
        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }
            let query = options?.rowMode ? { text: sql, values: params, rowMode: 'array' } : { text: sql, values: params };
            let res;
            if (connection) {
                logger.log('reused connection', sql, util.inspect(params, false, null), connection.processID);
                res = await connection.query(query);
                await this.checkAndFixOids(connection, res.fields);
            }
            else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(params, false, null), connection.processID);
                connection.on('error', QueryAble.connectionErrorListener);
                try {
                    res = await connection.query(query);
                    await this.checkAndFixOids(connection, res.fields);
                }
                finally {
                    connection.off('error', QueryAble.connectionErrorListener);
                    connection.release();
                    connection = null;
                }
            }
            this.postProcessFields(res.rows, res.fields, logger);
            return options?.rowMode ? { columns: (res.fields || []).map(f => f.name), rows: res.rows || [] } : res.rows;
        }
        catch (e) {
            pgUtils.logError(logger, { error: e, sql, params, connection });
            if (connection) {
                try {
                    connection.off('error', QueryAble.connectionErrorListener);
                    connection.release();
                }
                catch (e) {
                    logger.error('connection error', e.message);
                }
            }
            throw e;
        }
    }
    async queryAsRows(sql, params, options) {
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        return this.internalQuery({ connection, sql, params, logger, rowMode: true });
    }
    async queryWithOnCursorCallback(sql, params, options, callback) {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let connection = this.db.connection;
        let logger = this.getLogger(true);
        let positionedParams;
        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }
            else {
                positionedParams = params ?? undefined;
            }
            let queryInternal = async () => {
                this.getLogger(false).log(sql, util.inspect(positionedParams, false, null), connection.processID);
                let fieldsToFix;
                let isFirst = true;
                let query = new QueryStream(sql, positionedParams);
                let stream = connection.query(query);
                await new Promise((resolve, reject) => {
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
                    await this.checkAndFixOids(connection, fieldsToFix);
                    query = new QueryStream(sql, positionedParams);
                    stream = connection.query(query);
                    await new Promise((resolve, reject) => {
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
            };
            if (connection) {
                await queryInternal();
            }
            else {
                connection = await this.db.pool.connect();
                logger.log('new connection', sql, util.inspect(positionedParams, false, null), connection.processID);
                connection.on('error', QueryAble.connectionErrorListener);
                await queryInternal();
                connection.off('error', QueryAble.connectionErrorListener);
                connection.release();
            }
        }
        catch (e) {
            pgUtils.logError(logger, { error: e, sql, params, connection });
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
    }
    async queryAsStream(sql, params, options) {
        if (this.db.needToFixConnectionForListen()) {
            await this.db.runRestartConnectionForListen();
        }
        let connection = this.db.connection;
        let logger = (options && options.logger || this.getLogger(false));
        let pgStream;
        let queryable = this;
        let isFirst = true;
        let convertTypeFilter = new Transform({
            objectMode: true,
            transform(data, encoding, cb) {
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
                cb();
            },
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
            pgUtils.logError(logger, { error: e, sql, params, connection });
        });
        let positionedParams;
        try {
            if (params && !Array.isArray(params)) {
                let p = pgUtils.processNamedParams(sql, params);
                sql = p.sql;
                params = p.params;
            }
            else {
                positionedParams = params ?? undefined;
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
                connection = await this.db.pool.connect();
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
                    pgUtils.logError(logger, { error: e, sql, params: positionedParams, connection });
                    if (connection) {
                        connection.off('error', QueryAble.connectionErrorListener);
                        connection.release();
                    }
                    connection = null;
                });
                convertTypeFilter.on('close', () => {
                    pgStream.destroy();
                });
                return pgStream.pipe(convertTypeFilter);
            }
        }
        catch (e) {
            pgUtils.logError(logger, { error: e, sql, params: positionedParams, connection });
            throw e;
        }
    }
    async queryOne(sql, params, options) {
        let res = await this.query(sql, params, options);
        if (res.length > 1) {
            let logger = (options && options.logger || this.getLogger(false));
            let error = Error('More then one rows exists');
            pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
            throw error;
        }
        return res[0];
    }
    async queryFirst(sql, params, options) {
        let res = await this.query(sql, params, options);
        return res[0];
    }
    async queryOneField(sql, params, options) {
        let res = await this.query(sql, params, options);
        if (!res.length) {
            return null;
        }
        let fieldName = Object.keys(res[0])[0];
        if (res.length > 1) {
            let logger = (options && options.logger || this.getLogger(false));
            let error = Error('More then one field exists!');
            pgUtils.logError(logger, { error, sql, params, connection: this.db.connection });
            throw error;
        }
        return res.length == 1 ? res[0][fieldName] : null;
    }
    async queryOneColumn(sql, params, options) {
        let res = await this.query(sql, params, options);
        if (!res.length) {
            return [];
        }
        let fieldName = Object.keys(res[0])[0];
        return res.map(r => r[fieldName]);
    }
    postProcessFields(rows, fields, logger) {
        pgUtils.postProcessResult(rows, fields, this.db.pgdbTypeParsers);
        if (this.db.postProcessResult)
            this.db.postProcessResult(rows, fields, logger);
    }
    async checkAndFixOids(connection, fields) {
        if (fields) {
            let oidList = fields.map(field => field.dataTypeID);
            return this.db.resetMissingParsers(connection, oidList);
        }
    }
    hasUnknownOids(fields) {
        let oidList = fields.map(field => field.dataTypeID);
        let unknownOids = oidList.filter(oid => !this.db.knownOids[oid]);
        return !!unknownOids.length;
    }
}
//# sourceMappingURL=queryAble.js.map