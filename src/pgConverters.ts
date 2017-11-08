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
            (parsingResult[1] == null ? parsingResult[2] : JSON.parse(parsingResult[1])); // for string parsing, escape \
        valList.push(valStr);
    } while (e.lastIndex < str.length);
    return valList;
};
export let numWithValidation = val => {
    let v = +val;
    if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
        throw Error("Number can't be represented in javascript precisely: " + val);
    }
    return v;
};
export let arraySplitToNum = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(Number);
export let arraySplitToNumWithValidation = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(numWithValidation);
export let stringArrayToNumWithValidation = val => val.map(numWithValidation);
export let arraySplitToDate = val => val == "{}" ? [] : val.substring(1, val.length - 1).split(',').map(d => moment(d.substring(1, d.length - 1)).toDate());
export let arraySplitToJson = (str) => {
    let vals = arraySplit(str);
    return vals.map(s=> typeof s === 'string' ? JSON.parse(s) : s);
};
