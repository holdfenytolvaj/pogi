"use strict";

var util = require("util");
function escapeForLike(s) {
    return s.replace(/(\\|%|_)/g, '\\$1');
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    // lowercase comparison
    '=*': { operator: '=', mutator: s => s.toLocaleLowerCase(), fieldMutator: s => util.format('LOWER("%s")', s) },
    // caseless contains for string
    'icontains': { operator: 'ILIKE', mutator: s => '%' + escapeForLike(s) + '%' },
    // contains for array
    //'acontains':  value = ANY("columnName")
    // basic comparison
    '=': { operator: '=' },
    '!': { operator: '<>' },
    '>': { operator: '>' },
    '<': { operator: '<' },
    '>=': { operator: '>=' },
    '<=': { operator: '<=' },
    '!=': { operator: '<>' },
    '<>': { operator: '<>' },
    'is not': { operator: 'IS NOT' },
    // jsonb / array
    '@>': { operator: '@>' },
    '<@': { operator: '<@' },
    '&&': { operator: '&&' },
    // jsonb
    '?': { operator: '?' },
    '?|': { operator: '?|' },
    '?&': { operator: '?&' },
    // pattern matching
    '~~': { operator: 'LIKE' },
    'like': { operator: 'LIKE' },
    '!~~': { operator: 'NOT LIKE' },
    'not like': { operator: 'NOT LIKE' },
    '~~*': { operator: 'ILIKE' },
    'ilike': { operator: 'ILIKE' },
    '!~~*': { operator: 'NOT ILIKE' },
    'not ilike': { operator: 'NOT ILIKE' },
    'similar to': { operator: 'SIMILAR TO' },
    'not similar to': { operator: 'NOT SIMILAR TO' },
    // regexp
    '~': { operator: '~' },
    '!~': { operator: '!~' },
    '~*': { operator: '~*' },
    '!~*': { operator: '!~*' },
    // distinct
    'is distinct from': { operator: 'IS DISTINCT FROM' },
    'is not distinct from': { operator: 'IS NOT DISTINCT FROM' }
};
//# sourceMappingURL=pgDbOperators.js.map