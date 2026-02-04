import _ from "lodash";
import util from "node:util";
import { FieldType } from "./pgDb.js";
import operationsMap from "./pgDbOperators.js";
import { pgUtils } from "./pgUtils.js";
function generateWhere(conditions, fieldTypes, tableName, placeholderOffset = 0, skipUndefined) {
    let result = generate({
        params: [],
        predicates: [],
        offset: placeholderOffset,
    }, conditions, fieldTypes, tableName, skipUndefined);
    return {
        where: result.predicates.length > 0 ? ' WHERE ' + result.predicates.join(' AND ') : '',
        params: result.params
    };
}
function generate(result, conditions, fieldTypes, tableName, skipUndefined) {
    _.each(conditions, (value, key) => {
        let fieldAndOperator = parseKey(key);
        if (value === undefined) {
            if (skipUndefined === true)
                return;
            throw new Error('Invalid conditions! Field value undefined: "' + fieldAndOperator.field + '". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        else if (fieldAndOperator.field === 'or' || fieldAndOperator.field === 'and') {
            result = handleOrAnd(result, fieldAndOperator, value, fieldTypes, tableName, skipUndefined);
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
function handleOrAnd(result, fieldAndOperator, value, fieldTypes, tableName, skipUndefined) {
    if (!Array.isArray(value)) {
        value = [value];
    }
    let groupResult = _.reduce(value, (acc, v) => {
        let subResult = generate({
            params: [],
            predicates: [],
            offset: result.params.length + acc.offset
        }, v, fieldTypes, tableName, skipUndefined);
        acc.predicates.push('(' + subResult.predicates.join(' AND ') + ')');
        acc.params = acc.params.concat(subResult.params);
        acc.offset += subResult.params.length;
        return acc;
    }, {
        params: [],
        predicates: [],
        offset: result.offset
    });
    result.params = result.params.concat(groupResult.params);
    if (groupResult.predicates.length) {
        if (fieldAndOperator.field === 'and') {
            result.predicates.push(util.format('(%s)', groupResult.predicates.join(' AND ')));
        }
        else {
            result.predicates.push(util.format('(%s)', groupResult.predicates.join(' OR ')));
        }
    }
    return result;
}
function handleNullValue(result, fieldAndOperator, value) {
    fieldAndOperator.operator = fieldAndOperator.operator === '=' ? 'IS' : 'IS NOT';
    result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
    return result;
}
function handleArrayValue(result, fieldAndOperator, value, fieldTypes) {
    if (fieldAndOperator.mutator) {
        value = value.map((v) => fieldAndOperator.mutator(v));
    }
    let fieldType = fieldTypes[fieldAndOperator.field];
    let position = '$' + (result.params.length + 1 + result.offset);
    if (fieldType == FieldType.JSON &&
        ['?|', '?&'].indexOf(fieldAndOperator.operator) != -1) {
        result.params.push(value);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    else if (fieldType == FieldType.JSON &&
        ['@>', '<@', '&&'].indexOf(fieldAndOperator.operator) != -1) {
        result.params.push(JSON.stringify(value));
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    else if ((!fieldType || fieldType == FieldType.TIME) &&
        ['=', '<>', 'IN', 'NOT IN'].includes(fieldAndOperator.operator)) {
        if (fieldAndOperator.operator === '=' || fieldAndOperator.operator === 'IN') {
            fieldAndOperator.operator = '= ANY';
        }
        else {
            fieldAndOperator.operator = '<> ALL';
        }
        if (value.length === 0) {
            throw new Error('Invalid conditions! empty array for field:"' + fieldAndOperator.field + '" and operator:"' + fieldAndOperator.operator + '"');
        }
        result.params.push(value
            .map(v => (fieldType == FieldType.TIME && !(v instanceof Date)) ? new Date(v) : v));
        result.predicates.push(util.format('%s %s (%s)', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    else if (!fieldType && ['LIKE', 'ILIKE', 'SIMILAR TO', '~', '~*'].indexOf(fieldAndOperator.operator) != -1) {
        result.params.push(value);
        result.predicates.push(util.format('%s %s ANY(%s)', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    else if (!fieldType && ['NOT LIKE', 'NOT ILIKE', 'NOT SIMILAR TO', '!~', '!~*'].indexOf(fieldAndOperator.operator) != -1) {
        result.params.push(value);
        result.predicates.push(util.format('%s %s ALL(%s)', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    else if (fieldType == FieldType.ARRAY &&
        ['=', '<>', '<', '>', '<=', '>=', '@>', '<@', '&&'].indexOf(fieldAndOperator.operator) != -1) {
        result.params.push(value);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, position));
        return result;
    }
    throw new Error('[325] Not implemented operator: "' + fieldAndOperator.operator + '" for field ' + fieldAndOperator.field + ' with type ' + fieldType);
}
function handleSingleValue(result, fieldAndOperator, value, fieldTypes, tableName) {
    if (fieldAndOperator.mutator) {
        value = fieldAndOperator.mutator(value);
    }
    let fieldType = fieldTypes[fieldAndOperator.field];
    if (fieldAndOperator.operator === '@@') {
        if (typeof value == 'object') {
            if (!(value.lang || value.language) || !(value.query || value.plainquery)) {
                throw new Error('[499] only "lang"/"language" and "query/plainquery" properties are supported!');
            }
            if (fieldType == FieldType.TSVECTOR) {
                result.params.push(value.lang || value.language);
                result.params.push(value.query || value.plainquery);
                let template = value.query ? "%s %s to_tsquery($%s, $%s)" : "%s %s plainto_tsquery($%s, $%s)";
                result.predicates.push(util.format(template, fieldAndOperator.quotedField, fieldAndOperator.operator, result.params.length - 1 + result.offset, result.params.length + result.offset));
            }
            else {
                result.params.push(value.lang || value.language);
                result.params.push(value.lang || value.language);
                result.params.push(value.query || value.plainquery);
                let template = value.query ? "to_tsvector($%s, %s) %s to_tsquery($%s, $%s)" : "to_tsvector($%s, %s) %s plainto_tsquery($%s, $%s)";
                result.predicates.push(util.format(template, result.params.length - 2 + result.offset, fieldAndOperator.quotedField, fieldAndOperator.operator, result.params.length - 1 + result.offset, result.params.length + result.offset));
            }
        }
        else {
            result.params.push(value);
            let template = fieldType == FieldType.TSVECTOR ? "%s %s plainto_tsquery($%s)" : "to_tsvector(%s) %s plainto_tsquery($%s)";
            result.predicates.push(util.format(template, fieldAndOperator.quotedField, fieldAndOperator.operator, result.params.length + result.offset));
        }
    }
    else if (fieldType == FieldType.ARRAY) {
        if (['=', '<>'].indexOf(fieldAndOperator.operator) != -1) {
            if (fieldAndOperator.originalOp == '=*') {
                result.params.push([value]);
                value = util.format("$%s", result.params.length + result.offset);
                result.predicates.push(util.format('%s && %s', fieldAndOperator.quotedField, value));
            }
            else {
                result.params.push(value);
                value = util.format("$%s", result.params.length + result.offset);
                result.predicates.push(util.format('%s %s ANY(%s)', value, fieldAndOperator.operator, fieldAndOperator.quotedField));
            }
        }
        else if (['LIKE', 'ILIKE', 'NOT LIKE', 'NOT ILIKE', 'SIMILAR TO', 'NOT SIMILAR TO'].indexOf(fieldAndOperator.operator) != -1) {
            result.params.push(value);
            value = util.format("$%s", result.params.length + result.offset);
            let q = 'EXISTS (SELECT * FROM (SELECT UNNEST(' + tableName + '.%s) _el) _arr WHERE _arr._el %s %s)';
            result.predicates.push(util.format(q, fieldAndOperator.quotedField, fieldAndOperator.operator, value));
        }
        else {
            throw new Error('[326] Not implemented operator: "' + fieldAndOperator.operator + '" for type ' + fieldType);
        }
    }
    else {
        result.params.push((fieldType == FieldType.TIME && !(value instanceof Date)) ? new Date(value) : value);
        value = util.format("$%s", result.params.length + result.offset);
        result.predicates.push(util.format('%s %s %s', fieldAndOperator.quotedField, fieldAndOperator.operator, value));
    }
    return result;
}
function strip(arr) {
    return arr.map((s) => s.trim()).filter(v => v != '');
}
function getOp(str) {
    for (let i = 0; i < str.length; i++) {
        if (operationsMap[str.substr(i)]) {
            return str.substr(i);
        }
    }
    return '';
}
function parseKey(key) {
    key = key.trim();
    let userOp = getOp(key);
    if (userOp) {
        key = key.substr(0, key.length - userOp.length);
    }
    let operation = operationsMap[userOp] || {};
    let jsonRegexp = /(->[^>]|->>|#>[^>]|#>>)/;
    let field;
    let quotedField;
    let quotedByUser = key.indexOf('"') > -1;
    if (quotedByUser) {
        quotedField = key;
        field = /[^"]*"([^"]*)".*/.exec(key)?.[1];
        if (!quotedField || !field) {
            throw new Error('Invalid field:' + key);
        }
    }
    else {
        let parts = strip(key.split(jsonRegexp));
        field = parts.shift();
        if (!field) {
            throw new Error('Invalid field:' + key);
        }
        quotedField = pgUtils.quoteFieldName(field);
        if (parts.length > 1) {
            let jsonOp = parts.shift();
            let jsonKey = parts.shift();
            jsonKey = pgUtils.quoteFieldNameJsonbOrPosition(jsonKey);
            quotedField = util.format('%s%s%s', quotedField, jsonOp, jsonKey);
        }
    }
    if (operation.fieldMutator) {
        quotedField = operation.fieldMutator(field, quotedField);
    }
    return {
        field: field,
        quotedField: quotedField,
        operator: (operation.operator || '=').toUpperCase(),
        mutator: operation.mutator,
        originalOp: userOp
    };
}
export default generateWhere;
//# sourceMappingURL=queryWhere.js.map