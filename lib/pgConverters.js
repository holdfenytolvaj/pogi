"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
exports.arraySplit = str => {
    if (str == "{}") return [];
    str = str.substring(1, str.length - 1);
    let e = /(?:"((?:[^"]|\\")*)"|([^,"]*))(?:,|$)/g;
    let valList = [];
    let parsingResult;
    do {
        parsingResult = e.exec(str);
        let valStr = parsingResult[2] == 'NULL' ? null : (parsingResult[1] == null ? parsingResult[2] : parsingResult[1].replace(/\\\\/g, '\\')).replace(/\\"/g, '"');
        valList.push(valStr);
    } while (parsingResult[0].substring(parsingResult[0].length - 1, parsingResult[0].length) == ',');
    return valList;
};
exports.numWithValidation = val => {
    let v = +val;
    if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
        throw Error("Number can't be represented in javascript precisely: " + val);
    }
    return v;
};
exports.arraySplitToNum = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(Number);
exports.arraySplitToNumWithValidation = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(exports.numWithValidation);
exports.stringArrayToNumWithValidation = val => val.map(exports.numWithValidation);
exports.arraySplitToDate = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(d => moment(d.substring(1, d.length - 1)).toDate());
//# sourceMappingURL=pgConverters.js.map