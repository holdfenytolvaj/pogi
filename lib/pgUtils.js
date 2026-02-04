import util from 'node:util';
import { FieldType } from "./pgDb.js";
const NAMED_PARAMS_REGEXP = /(?:^|[^:]):(!?[a-zA-Z0-9_]+)/g;
const ASC_DESC_REGEXP = /^\s*(.+?)(?:\s+(asc|desc))?\s*$/i;
export let pgUtils = {
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
    quoteFieldNameOrPositionInsecure(f) {
        if (Number.isInteger(+f)) {
            if (!Number.isInteger(+f) || +f < 1)
                throw new Error(`Invalid field: ${f}`);
            return '' + f;
        }
        else if (typeof f === 'string' && f.length) {
            return f.indexOf('"') == -1 && f.indexOf('(') == -1 ? '"' + f + '"' : f;
        }
        else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    quoteFieldNameOrPosition(f) {
        if (Number.isInteger(+f)) {
            if (!Number.isInteger(+f) || +f < 1)
                throw new Error(`Invalid field: ${f}`);
            return '' + f;
        }
        else if (typeof f === 'string' && f.length) {
            return `"${f
                .replace(/^\s*"*\s*/, '')
                .replace(/\s*"*\s*$/, '')
                .replace(/"/g, '""')}"`;
        }
        else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    quoteFieldNameJsonbOrPosition(f) {
        if (Number.isInteger(+f)) {
            return '' + f;
        }
        if (typeof f === 'string' && f.length) {
            return `'${f
                .replace(/^\s*'*/, '')
                .replace(/'*\s*$/, '')
                .replace(/'/g, "''")}'`;
        }
        else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    processQueryFields(options, pgTable) {
        let escapeColumns = ((pgTable?.db.config.forceEscapeColumns === true || pgTable?.db.config.forceEscapeColumns?.select === true)
            && options.forceEscapeColumns !== false && options.forceEscapeColumns?.select !== false)
            || options.forceEscapeColumns === true
            || options.forceEscapeColumns?.select;
        let s = options && options.distinct ? ' DISTINCT ' : ' ';
        if (options && options.fields) {
            if (Array.isArray(options.fields)) {
                if (escapeColumns) {
                    return s + options.fields.map(pgUtils.quoteFieldName).join(', ');
                }
                return s + options.fields.map(pgUtils.quoteFieldNameInsecure).join(', ');
            }
            else {
                return s + (escapeColumns ? pgUtils.quoteFieldName(options.fields) : pgUtils.quoteFieldNameInsecure(options.fields));
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
                sql2.push(pgUtils.quoteFieldName(params[name]));
            }
            else {
                params2.push(params[name]);
                sql2.push('$' + params2.length);
            }
            lastIndex = NAMED_PARAMS_REGEXP.lastIndex;
            p = NAMED_PARAMS_REGEXP.exec(sql);
        }
        sql2.push(sql.slice(lastIndex));
        return {
            sql: sql2.join(''),
            params: params2
        };
    },
    handleColumnEscapeGroupBy(options, pgTable) {
        if (!options.groupBy)
            return '';
        let escapeColumns = ((pgTable?.db.config.forceEscapeColumns === true || pgTable?.db.config.forceEscapeColumns?.groupBy === true)
            && options.forceEscapeColumns !== false && options.forceEscapeColumns?.groupBy !== false)
            || options.forceEscapeColumns === true
            || options.forceEscapeColumns?.groupBy;
        if (escapeColumns) {
            if (Array.isArray(options.groupBy)) {
                return ' GROUP BY ' + options.groupBy.map(pgUtils.quoteFieldNameOrPosition).join(',');
            }
            else {
                return ' GROUP BY ' + pgUtils.quoteFieldNameOrPosition(options.groupBy);
            }
        }
        else {
            if (Array.isArray(options.groupBy)) {
                return ' GROUP BY ' + options.groupBy.map(pgUtils.quoteFieldNameOrPositionInsecure).join(',');
            }
            else {
                return ' GROUP BY ' + pgUtils.quoteFieldNameOrPositionInsecure(options.groupBy);
            }
        }
    },
    handleColumnEscapeOrderBy(options, pgTable) {
        if (!options.orderBy)
            return '';
        let sql = '';
        let escapeColumns = ((pgTable?.db.config.forceEscapeColumns === true || pgTable?.db.config.forceEscapeColumns?.orderBy === true)
            && options.forceEscapeColumns !== false && options.forceEscapeColumns?.orderBy !== false)
            || options.forceEscapeColumns === true
            || options.forceEscapeColumns?.orderBy;
        let orderBy = typeof options.orderBy === 'string' ? options.orderBy.split(',') :
            Array.isArray(options.orderBy) ? options.orderBy : Object.entries(options.orderBy).map(([k, v]) => k + ' ' + v);
        if (Array.isArray(orderBy)) {
            let orderBy2;
            if (escapeColumns) {
                orderBy2 = orderBy.map(v => {
                    if (typeof v === 'number')
                        return pgUtils.quoteFieldNameOrPosition(v);
                    else if (typeof v !== 'string' || !v.length)
                        throw new Error(`Invalid orderBy: ${v}`);
                    if (v[0] == '+')
                        return pgUtils.quoteFieldNameOrPosition(v.slice(1));
                    if (v[0] == '-')
                        return pgUtils.quoteFieldNameOrPosition(v.slice(1)) + ' desc';
                    let o = ASC_DESC_REGEXP.exec(v);
                    if (!o)
                        throw new Error(`Invalid orderBy: ${v}`);
                    return `${pgUtils.quoteFieldNameOrPosition(o[1])} ${o[2] ?? ''}`;
                });
            }
            else {
                orderBy2 = orderBy.map(v => {
                    if (typeof v === 'number')
                        return pgUtils.quoteFieldNameOrPositionInsecure(v);
                    else if (typeof v !== 'string' || !v.length)
                        throw new Error(`Invalid orderBy: ${v}`);
                    if (v[0] == '+')
                        return pgUtils.quoteFieldNameOrPositionInsecure(v.slice(1));
                    if (v[0] == '-')
                        return pgUtils.quoteFieldNameOrPositionInsecure(v.slice(1)) + ' desc';
                    let o = ASC_DESC_REGEXP.exec(v);
                    if (!o)
                        throw new Error(`Invalid orderBy: ${v}`);
                    return `${pgUtils.quoteFieldNameOrPositionInsecure(o[1])} ${o[2] ?? ''}`;
                });
            }
            sql += ' ORDER BY ' + orderBy2.join(',');
        }
        else {
            throw new Error(`Invalid orderBy: ${options.orderBy}`);
        }
        return sql;
    },
    processQueryOptions(options, pgTable) {
        options = options || {};
        let sql = '';
        if (options.groupBy) {
            sql += pgUtils.handleColumnEscapeGroupBy(options, pgTable);
        }
        if (options.orderBy) {
            sql += pgUtils.handleColumnEscapeOrderBy(options, pgTable);
            if (options.orderByNullsFirst != null) {
                sql += ' NULLS ' + options.orderByNullsFirst ? 'FIRST' : 'LAST';
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
        return (param != null && fieldType == FieldType.JSON) ? JSON.stringify(param) :
            (param != null && fieldType == FieldType.TIME && !(param instanceof Date)) ? new Date(param) : param;
    },
    postProcessResult(res, fields, pgdbTypeParsers) {
        if (res) {
            if (res[0] && !Array.isArray(res[0])) {
                if (Object.keys(res[0]).length != fields.length) {
                    throw new Error("Name collision for the query, two or more fields have the same name.");
                }
            }
            pgUtils.convertTypes(res, fields, pgdbTypeParsers);
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
        return async (...args) => {
            let placeHolders = [];
            let params = [];
            args.forEach((arg) => {
                placeHolders.push('$' + (placeHolders.length + 1));
                params.push(arg);
            });
            let res = await q.query(`SELECT "${fn.schema}"."${fn.name}"(${placeHolders.join(',')})`, params);
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
        };
    },
    escapeForLike(s) {
        return s.replace(/([\\%_])/g, '\\$1');
    }
};
//# sourceMappingURL=pgUtils.js.map