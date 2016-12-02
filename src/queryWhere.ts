import operationsMap from "./pgDbOperators";
import {FieldType} from "./pgDb";
var _ = require("lodash");
var util = require("util");

class FieldAndOperator {
    field: string;
    quotedField: string;
    operator: string;
    mutator?: Function;
}

function generateWhere(conditions, fieldTypes:{[index:string]:FieldType}, tableName:string, placeholderOffset=0) : {where:string, params:Array<any>} {
    var result = generate({
        params: [],
        predicates: [],
        offset: placeholderOffset,
    }, conditions, fieldTypes, tableName);

    return {
        where: result.predicates.length>0 ? ' WHERE ' + result.predicates.join(' AND ') : '',
        params: result.params
    };
}

function generate(result, conditions, fieldTypes:{[index:string]:FieldType}, tableName:string) {
    _.each(conditions, (value, key) => {
        var fieldAndOperator = parseKey(key);

        if (value === undefined) { //null is ok, but undefined is skipped
            return;
        }
        else if (fieldAndOperator.field === 'or' || fieldAndOperator.field === 'and') {
            result = handleOrAnd(result, fieldAndOperator, value, fieldTypes, tableName);
        }
        else if (value === null) {
            result = handleNullValue(result, fieldAndOperator, value);
        }
        else if (Array.isArray(value)) {
            result = handleArrayValue(result, fieldAndOperator, value, fieldTypes);
        }
        else {
            result = handleSingleValue(result, fieldAndOperator, value, fieldTypes, tableName);
        }
    });

    return result;
}

function handleOrAnd(result, fieldAndOperator, value, fieldTypes:{[index:string]:FieldType}, tableName:string) {
    if (!Array.isArray(value)) {
        value = [value];
    }

    var groupResult = _.reduce(value, (acc, v) => {
        // assemble predicates for each subgroup in this 'or' array
        var subResult = generate({
            params: [],
            predicates: [],
            offset: result.params.length + acc.offset   // ensure the offset from predicates outside the subgroup is counted
        }, v, fieldTypes, tableName);

        // encapsulate and join the individual predicates with AND to create the complete subgroup predicate
        acc.predicates.push(util.format('(%s)', subResult.predicates.join(' AND ')));
        acc.params = acc.params.concat(subResult.params);
        acc.offset += subResult.params.length;

        return acc;
    }, {
        params: [],
        predicates: [],
        offset: result.offset
    });

    // join the compiled subgroup predicates with OR, encapsulate, and push the
    // complex predicate ("((x = $1 AND y = $2) OR (z = $3))") onto the result object
    result.params = result.params.concat(groupResult.params);

    if (fieldAndOperator.field === 'and') {
        result.predicates.push(util.format('(%s)', groupResult.predicates.join(' AND ')));
    } else {
        result.predicates.push(util.format('(%s)', groupResult.predicates.join(' OR ')));
    }
    return result;
}

function handleNullValue(result, fieldAndOperator, value) {
    fieldAndOperator.operator = fieldAndOperator.operator === '=' ? 'IS' : 'IS NOT';
    result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
    return result;
}

function handleArrayValue(result, fieldAndOperator, value, fieldTypes:{[index:string]:FieldType}) {
    if (fieldAndOperator.mutator) {
        value = value.map(v=>fieldAndOperator.mutator(v));
    }

    if (fieldTypes[fieldAndOperator.field] == FieldType.JSON &&
        ['?|', '?&'].indexOf(fieldAndOperator.operator)!=-1) {
        result.params.push(value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }
    else if (fieldTypes[fieldAndOperator.field] == FieldType.JSON &&
        ['@>', '<@', '&&'].indexOf(fieldAndOperator.operator)!=-1) {
        result.params.push(JSON.stringify(value));
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }
    else if (!fieldTypes[fieldAndOperator.field] &&
        ['=','<>','in','not in'].indexOf(fieldAndOperator.operator.toLowerCase())!=-1) {
        var arrayConditions = [];
        if (fieldAndOperator.operator === '=' ) {
            fieldAndOperator.operator = 'IN';
        }
        else if (fieldAndOperator.operator === '<>' ) {
            fieldAndOperator.operator = 'NOT IN';
        }

        if (value.length === 0){  // avoid empty "[NOT] IN ()"
            throw new Error('Invalid conditions: empty array for field:"' + fieldAndOperator.field + '" and operator:"' + fieldAndOperator.operator +'"');
            //return result;
        }

        value.forEach(v => {
            let fieldType = fieldTypes[fieldAndOperator.field];
            result.params.push((fieldType == FieldType.TIME && !(value instanceof Date)) ? new Date(v) : v);
            arrayConditions.push(util.format("$%s", result.params.length + result.offset));
        });

        value = util.format('(%s)', arrayConditions.join(', '));
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }
    else if (!fieldTypes[fieldAndOperator.field] && ['LIKE', 'ILIKE', 'SIMILAR TO', '~', '~*'].indexOf(fieldAndOperator.operator)!=-1) {
        //defaults to any
        result.params.push(value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s ANY(%s)', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }
    else if (!fieldTypes[fieldAndOperator.field] && ['NOT LIKE', 'NOT ILIKE', 'NOT SIMILAR TO', '!~', '!~*'].indexOf(fieldAndOperator.operator)!=-1) {
        //defaults to all
        result.params.push(value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s ALL(%s)', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }
    else if (fieldTypes[fieldAndOperator.field] == FieldType.ARRAY &&
             ['=', '<>', '<', '>', '<=', '>=', '@>', '<@', '&&'].indexOf(fieldAndOperator.operator)!=-1) {
        result.params.push(value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        return result;
    }

    throw new Error('[325] Not implemented operator: "' +fieldAndOperator.operator + '" for type ' + fieldTypes[fieldAndOperator.field]);
}


function handleSingleValue(result, fieldAndOperator, value, fieldTypes:{[index:string]:FieldType}, tableName) {
    if (fieldAndOperator.mutator) {
        value = fieldAndOperator.mutator(value);
    }
    let fieldType = fieldTypes[fieldAndOperator.field];
    if (fieldType == FieldType.ARRAY) {
        if (['=','<>'].indexOf(fieldAndOperator.operator)!=-1) {
            result.params.push(value);
            value = util.format("$%s", result.params.length + result.offset);
            result.predicates.push(util.format('%s %s ANY(%s)',  value, fieldAndOperator.operator, fieldAndOperator.quotedField));
        }
        else if (['LIKE', 'ILIKE', 'NOT LIKE', 'NOT ILIKE', 'SIMILAR TO', 'NOT SIMILAR TO'].indexOf(fieldAndOperator.operator)!=-1) {
            result.params.push(value);
            value = util.format("$%s", result.params.length + result.offset);

            let q = 'EXISTS (SELECT * FROM (SELECT UNNEST(' + tableName + '.%s) _el) _arr WHERE _arr._el %s %s)';
            result.predicates.push(util.format(q, fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        } else {
            throw new Error('[326] Not implemented operator: "' +fieldAndOperator.operator + '" for type ' + fieldTypes[fieldAndOperator.field]);
        }
    } else {
        result.params.push((fieldType == FieldType.TIME && !(value instanceof Date)) ? new Date(value) : value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
    }
    return result;
}


function strip(arr) {
    return arr.map((s) => s.trim()).filter(v => v!='');
}

function getOp(str) {
    for (let i=0;i<str.length;i++) {
        if (operationsMap[str.substr(i)]){
            return str.substr(i);
        }
    }
    return '';
}

/**
 * Parse out a criterion key into something more intelligible. Supports quoted
 * field names and whitespace between components.
 *
 * 'createdTs >' => {field:'createdTs', quotedField:'"createdTs"', operator:'>', mutator:null}
 *
 * @param  {String} key Key in a format resembling "field [JSON operation+path] operation"
 * @return {Object}     [description]
 */
function parseKey(key):FieldAndOperator {
    key = key.trim();

    let userOp = getOp(key);
    if (userOp) {
        key = key.substr(0, key.length-userOp.length)
    }
    let operation = operationsMap[userOp] || {};
    let jsonRegexp = /(->[^>]|->>|#>[^>]|#>>)/;

    let field;
    let quotedField;

    let quotedByUser = key.indexOf('"')>-1; //key[0]=='"'; -> lets make it possible to write transformed columns, e.g. LOWER("field")
    if (quotedByUser) {
        field = key;
        quotedField = key;
    } else {
        let parts = strip(key.split(jsonRegexp));

        field = parts.shift();
        quotedField = util.format('"%s"', field);

        if (parts.length > 1) {
            var jsonOp = parts.shift();
            var jsonKey = parts.shift();

            // treat numeric json keys as array indices, otherwise quote it
            if (isNaN(jsonKey) && jsonKey.indexOf("'")==-1) {
                jsonKey = util.format("'%s'", jsonKey);
            }

            quotedField = util.format('%s%s%s', quotedField, jsonOp, jsonKey);
        }
    }


    if (operation.fieldMutator) {
        quotedField = operation.fieldMutator(field, quotedField);
    }


    return {
        field: field,
        quotedField: quotedField,
        operator: operation.operator || '=',
        mutator: operation.mutator
    };
}


export default generateWhere;

