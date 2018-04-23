"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
exports.arraySplit = str => {
    if (str == "{}") return [];
    str = str.substring(1, str.length - 1);
    let e = /(?:("(?:[^"\\]|\\.)*")|([^,"]*))(?:,|$)/g;
    let valList = [];
    let parsingResult;
    do {
        parsingResult = e.exec(str);
        let valStr = parsingResult[2] == 'NULL' ? null : parsingResult[1] == null ? parsingResult[2] : unescapeString(parsingResult[1]);
        valList.push(valStr);
    } while (e.lastIndex < str.length);
    return valList;
};
exports.numWithValidation = val => {
    if (val === 'NULL') {
        return null;
    }
    let v = +val;
    if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
        throw Error("Number can't be represented in javascript precisely: " + val);
    }
    return v;
};
exports.numberOrNull = val => {
    return +val;
};
exports.arraySplitToNum = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(exports.numberOrNull);
exports.arraySplitToNumWithValidation = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(exports.numWithValidation);
exports.stringArrayToNumWithValidation = val => val.map(exports.numWithValidation);
exports.arraySplitToDate = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(d => d == 'NULL' ? null : moment(d.substring(1, d.length - 1)).toDate());
exports.arraySplitToJson = str => {
    let vals = exports.arraySplit(str);
    return vals.map(s => typeof s === 'string' ? JSON.parse(s) : s);
};
function unescapeString(s) {
    return s.slice(1, s.length - 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
//# sourceMappingURL=pgConverters.js.map