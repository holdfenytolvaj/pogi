import * as moment from 'moment';

//--- add parsing for array types --------------------------------
export let arraySplit = (str) => {
    if (str == "{}") return [];
    str = str.substring(1, str.length - 1); //cut off {}
    let e = /(?:("(?:[^"\\]|\\.)*")|([^,"]*))(?:,|$)/g; //has to be mutable because of exec
    let valList = [];
    let parsingResult;
    do {
        parsingResult = e.exec(str);
        let valStr = (parsingResult[2] == 'NULL') ? null :
            (parsingResult[1] == null ? parsingResult[2] : unescapeString(parsingResult[1])); // for string parsing, escape \
        valList.push(valStr);
    } while (e.lastIndex < str.length);
    return valList;
};
export let numWithValidation = val => {
    if (val === 'NULL') {
        return null;
    }
    let v = +val;
    if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
        throw Error("Number can't be represented in javascript precisely: " + val);
    }
    return v;
};
export let numberOrNull = val => {
    if (val === 'NULL') {
        return null;
    }
    return +val;
};
export let boolOrNull = val => {
    if (val === 'NULL') {
        return null;
    }
    return val == 't';
}

export let arraySplitToBool = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(boolOrNull);
export let arraySplitToNum = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(numberOrNull);
export let arraySplitToNumWithValidation = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(numWithValidation);
export let stringArrayToNumWithValidation = val => val.map(numWithValidation);
export let arraySplitToDate = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(d => d == 'NULL' ? null : moment(d.substring(1, d.length - 1)).toDate());
export let arraySplitToJson = (str) => {
    let vals = arraySplit(str);
    return vals.map(s => typeof s === 'string' ? JSON.parse(s) : s);
};

function unescapeString(s) {
    return s.slice(1, s.length - 1)    // cut the first and the last "
        .replace(/\\"/g, '"')          // \" -> "
        .replace(/\\\\/g, '\\')        // \\ -> \
}
