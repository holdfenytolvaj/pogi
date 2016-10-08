"use strict";

var util = require('util');
const NAMED_PARAMS_REGEXP = /(?:^|[^:]):(!?[a-zA-Z0-9_]+)/g; // do not convert "::type cast"
const pgDb_1 = require("./pgDb");
exports.pgUtils = {
    quoteField(f) {
        return f.indexOf('"') == -1 ? '"' + f + '"' : f;
    },
    processQueryFields(options) {
        if (options && options.fields) {
            if (Array.isArray(options.fields)) {
                return ' ' + options.fields.map(exports.pgUtils.quoteField).join(',');
            } else {
                return ' ' + options.fields;
            }
        } else {
            return ' *';
        }
    },
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
    },
    processQueryOptions(options) {
        options = options || {};
        let sql = '';
        if (options.groupBy) {
            if (Array.isArray(options.groupBy)) {
                sql += ' GROUP BY ' + options.groupBy.map(exports.pgUtils.quoteField).join(',');
            } else {
                sql += ' GROUP BY ' + exports.pgUtils.quoteField(options.groupBy);
            }
        }
        if (options.orderBy) {
            if (Array.isArray(options.orderBy)) {
                sql += ' ORDER BY ' + options.orderBy.map(exports.pgUtils.quoteField).join(',');
            } else {
                sql += ' ORDER BY ' + exports.pgUtils.quoteField(options.orderBy);
            }
        }
        if (options.limit) {
            sql += util.format(' LIMIT %d', options.limit);
        }
        if (options.offset) {
            sql += util.format(' OFFSET %d', options.offset);
        }
        return sql;
    },
    /**
     * NOTE-DATE: there are 2 approaches to keep tz (the time correctly):
     *    1) use Date.toISOString() function, but then the $x placeholder should be TIMESTAMP WITH TIME ZONE $x
     *    2) use Date, and then no need to change the placeholder $x
     *    lets use 2)
     */
    transformInsertUpdateParams(param, fieldType) {
        return param != null && fieldType == pgDb_1.FieldType.JSON ? JSON.stringify(param) : param != null && fieldType == pgDb_1.FieldType.TIME && !(param instanceof Date) ? new Date(param) : param;
    }
};
//# sourceMappingURL=pgUtils.js.map