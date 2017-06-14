var util = require("util");

function escapeForLike(s) {
    return s.replace(/(\\|%|_)/g,'\\$1');
}


export default {
    // lowercase comparison
    '=*': {operator: '=', mutator: (s:string) => s.toLocaleLowerCase(), fieldMutator: s => util.format('LOWER("%s")',s)},

    // caseless contains for string
    'icontains': {operator: 'ILIKE', mutator: s => '%' + escapeForLike(s) + '%'},

    // contains for array
    //'acontains':  value = ANY("columnName")

    // basic comparison
    '=': {operator: '='},
    '!': {operator: '<>'},
    '>': {operator: '>'},
    '<': {operator: '<'},
    '>=': {operator: '>='},
    '<=': {operator: '<='},
    '!=': {operator: '<>'},
    '<>': {operator: '<>'},
    'is not': {operator: 'IS NOT'},

    // free text search
    '@@': {operator: '@@'}, //value can be {lang:string, query:string} or simply string (defaults to english)

    // jsonb / array
    '@>': {operator: '@>'}, //contains                          ARRAY[1,4,3] @> ARRAY[3,1]      => true
    '<@': {operator: '<@'}, //is contained by                   ARRAY[2,7] <@ ARRAY[1,7,4,2,6] 	=> true
    '&&': {operator: '&&'}, //overlap (have elements in common) ARRAY[1,4,3] && ARRAY[2,1]      => true

    // jsonb
    '?': {operator: '?'}, //exists key
    '?|': {operator: '?|'}, //exists any keys
    '?&': {operator: '?&'}, //exists all keys


    // pattern matching
    '~~': {operator: 'LIKE'},
    'like': {operator: 'LIKE'},
    '!~~': {operator: 'NOT LIKE'},
    'not like': {operator: 'NOT LIKE'},
    '~~*': {operator: 'ILIKE'},
    'ilike': {operator: 'ILIKE'},
    '!~~*': {operator: 'NOT ILIKE'},
    'not ilike': {operator: 'NOT ILIKE'},
    'similar to': {operator: 'SIMILAR TO'},
    'not similar to': {operator: 'NOT SIMILAR TO'},
    // regexp
    '~': {operator: '~'},
    '!~': {operator: '!~'},
    '~*': {operator: '~*'}, //Matches regular expression, case insensitive
    '!~*': {operator: '!~*'},
    // distinct
    'is distinct from': {operator: 'IS DISTINCT FROM'},
    'is not distinct from': {operator: 'IS NOT DISTINCT FROM'}
};
