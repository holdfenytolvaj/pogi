"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
function escapeForLike(s) {
    return s.replace(/([\\%_])/g, '\\$1');
}
exports.default = {
    '=*': { operator: '=', mutator: (s) => s.toLocaleLowerCase(), fieldMutator: s => util.format('LOWER("%s")', s) },
    'icontains': { operator: 'ILIKE', mutator: s => '%' + escapeForLike(s) + '%' },
    '=': { operator: '=' },
    '!': { operator: '<>' },
    '>': { operator: '>' },
    '<': { operator: '<' },
    '>=': { operator: '>=' },
    '<=': { operator: '<=' },
    '!=': { operator: '<>' },
    '<>': { operator: '<>' },
    'is not': { operator: 'IS NOT' },
    '@@': { operator: '@@' },
    '@>': { operator: '@>' },
    '<@': { operator: '<@' },
    '&&': { operator: '&&' },
    '&&*': { operator: '&&', mutator: (s) => s.toLocaleLowerCase(), fieldMutator: f => util.format('LOWER("%s")', f) },
    '?': { operator: '?' },
    '?|': { operator: '?|' },
    '?&': { operator: '?&' },
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
    '~': { operator: '~' },
    '!~': { operator: '!~' },
    '~*': { operator: '~*' },
    '!~*': { operator: '!~*' },
    'is distinct from': { operator: 'IS DISTINCT FROM' },
    'is not distinct from': { operator: 'IS NOT DISTINCT FROM' }
};
//# sourceMappingURL=pgDbOperators.js.map