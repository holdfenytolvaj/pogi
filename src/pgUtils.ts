import { QueryOptions, IQueryAble } from "./queryAbleInterface";
import { ResultFieldType } from "./pgDbInterface";
import { FieldType } from "./pgDb";
import { PgDbLogger } from "./pgDbLogger";
import * as _ from 'lodash';
import util = require('util');
import * as pg from 'pg';
import { ForceEscapeColumnsOptions } from "./connectionOptions";
import { PgTable } from ".";

const NAMED_PARAMS_REGEXP = /(?:^|[^:]):(!?[a-zA-Z0-9_]+)/g;    // do not convert "::type cast"
const ASC_DESC_REGEXP = /^\s*(.+?)(?:\s+(asc|desc))?\s*$/i;

export let pgUtils = {

    logError(logger: PgDbLogger, options: { error?: string | Error, sql: string, params: any, connection?: (pg.PoolClient & { processID?: string }) | null }) {
        let { error, sql, params, connection } = options;
        logger.error(error, sql, util.inspect(logger.paramSanitizer ? logger.paramSanitizer(params) : params, false, null), connection ? connection.processID : null);
    },

    quoteFieldNameInsecure(f: string) {
        return f.indexOf('"') == -1 && f.indexOf('(') == -1 ? '"' + f + '"' : f;
    },

    quoteFieldName(f: string) {
        if (typeof f === 'string' && f.length) {
            return `"${f
                .replace(/^\s*"*/, '') // trim "
                .replace(/"*\s*$/, '')
                .replace(/"/g, '""')}"`;
        } else {
            throw new Error(`Invalid field: ${f}`);
        }
    },

    quoteFieldNameOrPositionInsecure(f: string | number): string {
        if (Number.isInteger(+f)) {
            if (!Number.isInteger(+f) || +f < 1) throw new Error(`Invalid field: ${f}`);
            return '' + f;
        } else if (typeof f === 'string' && f.length) {
            return f.indexOf('"') == -1 && f.indexOf('(') == -1 ? '"' + f + '"' : f;
        } else {
            throw new Error(`Invalid field: ${f}`);
        }
    },

    /** ex. for order by column position can be use, which needs no quote  */
    quoteFieldNameOrPosition(f: string | number): string {
        if (Number.isInteger(+f)) {
            if (!Number.isInteger(+f) || +f < 1) throw new Error(`Invalid field: ${f}`);
            return '' + f;
        } else if (typeof f === 'string' && f.length) {
            return `"${f
                .replace(/^\s*"*\s*/, '') // trim "
                .replace(/\s*"*\s*$/, '')
                .replace(/"/g, '""')}"`;
        } else {
            throw new Error(`Invalid field: ${f}`);
        }
    },
    /**
     * https://www.postgresql.org/docs/current/functions-json.html 
     * column->'a' , 
     * column -> 3
     */
    quoteFieldNameJsonbOrPosition(f: string | number): string {
        // treat numeric json keys as array indices, otherwise quote it
        if (Number.isInteger(+f)) {
            return '' + f;
        } if (typeof f === 'string' && f.length) {
            return `'${f
                .replace(/^\s*'*/, '') // trim "
                .replace(/'*\s*$/, '')
                .replace(/'/g, "''")}'`;
        } else {
            throw new Error(`Invalid field: ${f}`);
        }
    },

    processQueryFields<T>(options: QueryOptions, pgTable?: PgTable<T>): string {
        let escapeColumns = (
            (pgTable?.db.config.forceEscapeColumns === true || (pgTable?.db.config.forceEscapeColumns as ForceEscapeColumnsOptions)?.select === true)
            && options.forceEscapeColumns !== false && (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.select !== false)
            || options.forceEscapeColumns === true
            || (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.select;

        let s = options && options.distinct ? ' DISTINCT ' : ' ';
        if (options && options.fields) {
            if (Array.isArray(options.fields)) {
                if (escapeColumns) {
                    return s + options.fields.map(pgUtils.quoteFieldName).join(', ');
                }
                return s + options.fields.map(pgUtils.quoteFieldNameInsecure).join(', ');
            } else {
                return s + options.fields;
            }
        } else {
            return s + ' *';
        }
    },

    /**
     * :named -> $1 (not works with DDL (schema, table, column))
     * :!named -> "value" (for DDL (schema, table, column))
     * do not touch ::type cast
     */
    processNamedParams(sql: string, params: Object) {
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
            } else {
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
        }
    },

    handleColumnEscapeGroupBy<T>(options: QueryOptions, pgTable?: PgTable<T>): string {
        if (!options.groupBy) return '';
        let escapeColumns = (
            (pgTable?.db.config.forceEscapeColumns === true || (pgTable?.db.config.forceEscapeColumns as ForceEscapeColumnsOptions)?.groupBy === true)
            && options.forceEscapeColumns !== false && (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.groupBy !== false)
            || options.forceEscapeColumns === true
            || (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.groupBy;

        if (escapeColumns) {
            if (Array.isArray(options.groupBy)) {
                return ' GROUP BY ' + options.groupBy.map(pgUtils.quoteFieldNameOrPosition).join(',');
            } else {
                return ' GROUP BY ' + pgUtils.quoteFieldNameOrPosition(options.groupBy);
            }
        } else {
            if (Array.isArray(options.groupBy)) {
                return ' GROUP BY ' + options.groupBy.map(pgUtils.quoteFieldNameOrPositionInsecure).join(',');
            } else {
                return ' GROUP BY ' + pgUtils.quoteFieldNameOrPositionInsecure(options.groupBy);
            }
        }
    },

    handleColumnEscapeOrderBy<T>(options: QueryOptions, pgTable: PgTable<T>): string {
        if (!options.orderBy) return '';
        let sql = '';
        let escapeColumns = (
            (pgTable?.db.config.forceEscapeColumns === true || (pgTable?.db.config.forceEscapeColumns as ForceEscapeColumnsOptions)?.orderBy === true)
            && options.forceEscapeColumns !== false && (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.orderBy !== false)
            || options.forceEscapeColumns === true
            || (options.forceEscapeColumns as ForceEscapeColumnsOptions)?.orderBy;

        let orderBy = typeof options.orderBy === 'string' ? options.orderBy.split(',') :
            Array.isArray(options.orderBy) ? options.orderBy : Object.entries(options.orderBy).map(([k, v]) => k + ' ' + v);

        if (Array.isArray(orderBy)) {
            let orderBy2: string[];

            if (escapeColumns) {
                orderBy2 = orderBy.map(v => {
                    if (typeof v === 'number') return pgUtils.quoteFieldNameOrPosition(v);
                    else if (typeof v !== 'string' || !v.length) throw new Error(`Invalid orderBy: ${v}`);
                    if (v[0] == '+') return pgUtils.quoteFieldNameOrPosition(v.slice(1));
                    if (v[0] == '-') return pgUtils.quoteFieldNameOrPosition(v.slice(1)) + ' desc';
                    let o = ASC_DESC_REGEXP.exec(v);
                    if (!o) throw new Error(`Invalid orderBy: ${v}`);
                    return `${pgUtils.quoteFieldNameOrPosition(o[1])} ${o[2] ?? ''}`;
                });
            } else {
                orderBy2 = orderBy.map(v => {
                    if (typeof v === 'number') return pgUtils.quoteFieldNameOrPositionInsecure(v);
                    else if (typeof v !== 'string' || !v.length) throw new Error(`Invalid orderBy: ${v}`);
                    if (v[0] == '+') return pgUtils.quoteFieldNameOrPositionInsecure(v.slice(1));
                    if (v[0] == '-') return pgUtils.quoteFieldNameOrPositionInsecure(v.slice(1)) + ' desc';
                    let o = ASC_DESC_REGEXP.exec(v);
                    if (!o) throw new Error(`Invalid orderBy: ${v}`);
                    return `${pgUtils.quoteFieldNameOrPositionInsecure(o[1])} ${o[2] ?? ''}`;
                });
            }
            sql += ' ORDER BY ' + orderBy2.join(',');
        } else {
            throw new Error(`Invalid orderBy: ${options.orderBy}`);
        }
        return sql;
    },

    processQueryOptions<T>(options: QueryOptions, pgTable: PgTable<T>): string {
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
            if (!Number.isInteger(options.limit) || options.limit < 0) throw new Error(`Invalid limit: ${options.limit}`);
            sql += ` LIMIT ${options.limit}`;
        }
        if (options.offset) {
            if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error(`Invalid offset: ${options.offset}`);
            sql += ` OFFSET ${options.offset}`;
        }
        if (options.forUpdate) {
            sql += ' FOR UPDATE';
        }
        return sql;
    },

    /**
     * NOTE-DATE: there are 2 approaches to keep tz (the time correctly):
     *    1) use Date.toISOString() function, but then the $x placeholder should be TIMESTAMP WITH TIME ZONE $x
     *    2) use Date, and then no need to change the placeholder $x
     *    lets use 2)
     */
    transformInsertUpdateParams(param: any, fieldType: FieldType) {
        return (param != null && fieldType == FieldType.JSON) ? JSON.stringify(param) :
            (param != null && fieldType == FieldType.TIME && !(param instanceof Date)) ? new Date(param) : param;
    },

    postProcessResult(res: any[], fields: ResultFieldType[], pgdbTypeParsers: { [oid: number]: (s: string) => any }) {
        if (res) {
            if (res[0] && !Array.isArray(res[0])) {
                if (Object.keys(res[0]).length != fields.length) {
                    throw new Error("Name collision for the query, two or more fields have the same name.");
                }
            }
            pgUtils.convertTypes(res, fields, pgdbTypeParsers);
        }
    },

    convertTypes(res: any[], fields: ResultFieldType[], pgdbTypeParsers: { [oid: number]: (s: string) => any }) {
        let isArrayMode = Array.isArray(res[0]);
        fields.forEach((field, i) => {
            if (pgdbTypeParsers[field.dataTypeID]) {
                if (isArrayMode) {
                    res.forEach(e => e[i] = e[i] == null ? null : pgdbTypeParsers[field.dataTypeID](e[i]));
                } else {
                    res.forEach(e => e[field.name] = e[field.name] == null ? null : pgdbTypeParsers[field.dataTypeID](e[field.name]));
                }
            }
        });
    },

    createFunctionCaller(q: IQueryAble, fn: { schema: string, name: string, return_single_row: boolean, return_single_value: boolean }) {
        return async (...args: any[]) => {
            let placeHolders: string[] = [];
            let params: any[] = [];
            args.forEach((arg) => {
                placeHolders.push('$' + (placeHolders.length + 1));
                params.push(arg);
            });
            let res = await q.query(`SELECT "${fn.schema}"."${fn.name}"(${placeHolders.join(',')})`, params);

            if (fn.return_single_value) {
                let keys = res[0] ? Object.keys(res[0]) : [];
                if (keys.length != 1) {
                    throw new Error(`Return type error. schema: ${fn.schema} fn: ${fn.name} expected return type: single value, current value:` + JSON.stringify(res))
                }
                res = res.map((r) => r[keys[0]]);
            }
            if (fn.return_single_row) {
                if (res.length != 1) {
                    throw new Error(`Return type error. schema: ${fn.schema} fn: ${fn.name} expected return type: single value, current value:` + JSON.stringify(res))
                }
                return res[0];
            } else {
                return res;
            }
        }
    },
    escapeForLike(s: string): string {
        return s.replace(/([\\%_])/g, '\\$1');
    }
};
