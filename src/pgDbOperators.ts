import { pgUtils } from "./pgUtils";

export default {
    /** lowercase comparison */
    '=*': {operator: '=', mutator: (s:string):string => s.toLocaleLowerCase(), fieldMutator: (s:string) => `LOWER("${s}")`},

    /**  case insensitive contains for string */
    'icontains': {operator: 'ILIKE', mutator: (s:string):string => '%' + pgUtils.escapeForLike(s) + '%'},

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

    /** free text search */
    '@@': {operator: '@@'}, //value can be {lang:string, query:string} or simply string (defaults to english)

    /** 
     * jsonb / array
     * contains                          ARRAY[1,4,3] @> ARRAY[3,1]      => true
     */
    '@>': {operator: '@>'},
    /** 
     * jsonb / array
     * is contained by                   ARRAY[2,7] <@ ARRAY[1,7,4,2,6] 	=> true
     */
     '<@': {operator: '<@'},
     /**
      * jsonb / array
      * overlap (have elements in common) ARRAY[1,4,3] && ARRAY[2,1]      => true
      */
    '&&': {operator: '&&'},
     /**
      * jsonb / array
      * case insensitive overlap (have elements in common) ARRAY[1,4,3] && ARRAY[2,1]      => true
      */
    '&&*': {operator: '&&',  mutator: (s:string) => s.toLocaleLowerCase(), fieldMutator: (f:string) => `LOWER("${f}")`},

    /** jsonb exists key */
    '?': {operator: '?'},
    /** jsonb exists any keys */
    '?|': {operator: '?|'},
    /** jsonb exists all keys */
    '?&': {operator: '?&'},


    /** LIKE */
    '~~': {operator: 'LIKE'},
    /** LIKE */
    'like': {operator: 'LIKE'},
    /** NOT LIKE */
    '!~~': {operator: 'NOT LIKE'},
    /** NOT LIKE */
    'not like': {operator: 'NOT LIKE'},
    /** ILIKE */
    '~~*': {operator: 'ILIKE'},
    /** ILIKE */
    'ilike': {operator: 'ILIKE'},
    /** NOT ILIKE */
    '!~~*': {operator: 'NOT ILIKE'},
    /** NOT ILIKE */
    'not ilike': {operator: 'NOT ILIKE'},
    /** SIMILAR TO */
    'similar to': {operator: 'SIMILAR TO'},
    /** NOT SIMILAR TO */
    'not similar to': {operator: 'NOT SIMILAR TO'},
    /** regexp matching */ 
    '~': {operator: '~'},
    '!~': {operator: '!~'},
    /** regexp matching, case insensitive */ 
    '~*': {operator: '~*'},
    '!~*': {operator: '!~*'},
    // distinct
    'is distinct from': {operator: 'IS DISTINCT FROM'},
    'is not distinct from': {operator: 'IS NOT DISTINCT FROM'}
};
