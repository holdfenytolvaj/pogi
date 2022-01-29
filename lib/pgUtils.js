"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgUtils = void 0;
const tslib_1 = require("tslib");
const pgDb_1 = require("./pgDb");
const util = require("util");
const NAMED_PARAMS_REGEXP = /(?:^|[^:]):(!?[a-zA-Z0-9_]+)/g;
const ASC_DESC_REGEXP = /^(.+?)(?:\s+(asc|desc))?$/i;
exports.pgUtils = {
    logError(logger, options) {
        let { error, sql, params, connection } = options;
        logger.error(error, sql, util.inspect(logger.paramSanitizer ? logger.paramSanitizer(params) : params, false, null), connection ? connection.processID : null);
    },
    quoteFieldNameInsecure(f) {
        return f.indexOf('"') == -1 && f.indexOf('(') == -1 ? '"' + f + '"' : f;
    },
    quoteFieldName(f) {
        if (typeof f === 'string' && f.length) {
            return `"${f
                .replace(/^\s*"*/, '')
                .replace(/"*\s*$/, '')
                .replace(/"/g, '""')}"`;
        }
        else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    quoteFieldNameOrPosition(f) {
        if (typeof f === 'string' && f.length) {
            return `"${f
                .replace(/^\s*"*/, '')
                .replace(/"*\s*$/, '')
                .replace(/"/g, '""')}"`;
        }
        else if (typeof f === 'number') {
            if (!Number.isInteger(f) || f < 1)
                throw new Error(`Invalid field: ${f}`);
            return '' + f;
        }
        else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    processQueryFields(options) {
        let s = options && options.distinct ? ' DISTINCT ' : ' ';
        if (options && options.fields) {
            if (Array.isArray(options.fields)) {
                return s + options.fields.map(exports.pgUtils.quoteFieldNameInsecure).join(', ');
            }
            else {
                return s + options.fields;
            }
        }
        else {
            return s + ' *';
        }
    },
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
                throw new Error(`No ${p[1]} in params (keys: ${Object.keys(params)})`);
            }
            sql2.push(sql.slice(lastIndex, NAMED_PARAMS_REGEXP.lastIndex - p[1].length - 1));
            if (ddl) {
                sql2.push('"' + ('' + params[name]).replace(/"/g, '""') + '"');
            }
            else {
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
    },
    processQueryOptions(options) {
        options = options || {};
        let sql = '';
        if (options.groupBy) {
            if (Array.isArray(options.groupBy)) {
                sql += ' GROUP BY ' + options.groupBy.map(exports.pgUtils.quoteFieldNameOrPosition).join(',');
            }
            else {
                sql += ' GROUP BY ' + exports.pgUtils.quoteFieldNameOrPosition(options.groupBy);
            }
        }
        if (options.orderBy) {
            let orderBy = typeof options.orderBy === 'string' ? options.orderBy.split(',') : options.orderBy;
            if (Array.isArray(orderBy)) {
                let orderBy2 = orderBy.map(v => {
                    var _a;
                    if (typeof v === 'number')
                        return exports.pgUtils.quoteFieldNameOrPosition(v);
                    else if (typeof v !== 'string' || !v.length)
                        throw new Error(`Invalid orderBy: ${v}`);
                    if (v[0] == '+')
                        return exports.pgUtils.quoteFieldNameOrPosition(v.slice(1));
                    if (v[0] == '-')
                        return exports.pgUtils.quoteFieldNameOrPosition(v.slice(1)) + ' desc';
                    let o = ASC_DESC_REGEXP.exec(v);
                    if (!o)
                        throw new Error(`Invalid orderBy: ${v}`);
                    return `${exports.pgUtils.quoteFieldNameOrPosition(o[1])} ${(_a = o[2]) !== null && _a !== void 0 ? _a : ''}`;
                });
                sql += ' ORDER BY ' + orderBy2.join(',');
            }
            else {
                throw new Error(`Invalid orderBy: ${options.orderBy}`);
            }
        }
        if (options.limit) {
            if (!Number.isInteger(options.limit) || options.limit < 0)
                throw new Error(`Invalid limit: ${options.limit}`);
            sql += ` LIMIT ${options.limit}`;
        }
        if (options.offset) {
            if (!Number.isInteger(options.offset) || options.offset < 0)
                throw new Error(`Invalid offset: ${options.offset}`);
            sql += ` OFFSET ${options.offset}`;
        }
        if (options.forUpdate) {
            sql += ' FOR UPDATE';
        }
        return sql;
    },
    transformInsertUpdateParams(param, fieldType) {
        return (param != null && fieldType == pgDb_1.FieldType.JSON) ? JSON.stringify(param) :
            (param != null && fieldType == pgDb_1.FieldType.TIME && !(param instanceof Date)) ? new Date(param) : param;
    },
    postProcessResult(res, fields, pgdbTypeParsers) {
        if (res) {
            if (res[0] && !Array.isArray(res[0])) {
                if (Object.keys(res[0]).length != fields.length) {
                    throw new Error("Name collision for the query, two or more fields have the same name.");
                }
            }
            exports.pgUtils.convertTypes(res, fields, pgdbTypeParsers);
        }
    },
    convertTypes(res, fields, pgdbTypeParsers) {
        let isArrayMode = Array.isArray(res[0]);
        fields.forEach((field, i) => {
            if (pgdbTypeParsers[field.dataTypeID]) {
                if (isArrayMode) {
                    res.forEach(e => e[i] = e[i] == null ? null : pgdbTypeParsers[field.dataTypeID](e[i]));
                }
                else {
                    res.forEach(e => e[field.name] = e[field.name] == null ? null : pgdbTypeParsers[field.dataTypeID](e[field.name]));
                }
            }
        });
    },
    createFunctionCaller(q, fn) {
        return (...args) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let placeHolders = [];
            let params = [];
            args.forEach((arg) => {
                placeHolders.push('$' + (placeHolders.length + 1));
                params.push(arg);
            });
            let res = yield q.query(`SELECT "${fn.schema}"."${fn.name}"(${placeHolders.join(',')})`, params);
            if (fn.return_single_value) {
                let keys = res[0] ? Object.keys(res[0]) : [];
                if (keys.length != 1) {
                    throw new Error(`Return type error. schema: ${fn.schema} fn: ${fn.name} expected return type: single value, current value:` + JSON.stringify(res));
                }
                res = res.map((r) => r[keys[0]]);
            }
            if (fn.return_single_row) {
                if (res.length != 1) {
                    throw new Error(`Return type error. schema: ${fn.schema} fn: ${fn.name} expected return type: single value, current value:` + JSON.stringify(res));
                }
                return res[0];
            }
            else {
                return res;
            }
        });
    }
};
//# sourceMappingURL=pgUtils.js.map