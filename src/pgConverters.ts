import * as moment from 'moment';

//--- add parsing for array types --------------------------------
export function parseArray(s: string): (string | null)[] {
    if (!s || s[0] !== '{' || s[s.length - 1] !== '}') throw new Error('Invalid array value:' + s);
    if (s == "{}") return [];
    s = s.slice(1, s.length - 1); //cut off {}
    let e = /(?:("(?:[^"\\]|\\.)*")|([^,"]*))(?:,|$)/g; //has to be mutable because of exec
    let valList: (string | null)[] = [];
    let parsingResult;
    do {
        parsingResult = e.exec(s);
        if (!parsingResult) throw new Error('Invalid array value:' + s);
        let valStr = (parsingResult[2] === 'NULL') ? null :
            (parsingResult[1] == null ? parsingResult[2] : unescapeString(parsingResult[1])); // for string parsing, escape \
        valList.push(valStr);
    } while (e.lastIndex < s.length);
    return valList;
};

export function parseNumberWithValidation(s: string): number | null {
    if (s === 'NULL') {
        return null;
    }
    let v = +s;
    if (v > Number.MAX_SAFE_INTEGER || v < Number.MIN_SAFE_INTEGER) {
        throw new Error("Number can't be represented in javascript precisely: " + s);
    }
    return v;
};

export function parseNumberOrNull(s: string): number | null {
    if (s === 'NULL') {
        return null;
    }
    return +s;
};

export function parseBoolOrNull(s: string): boolean | null {
    if (s === 'NULL') {
        return null;
    }
    return s == 't';
}

export let parseBooleanArray = (s: string): (boolean | null)[] => s == "{}" ? [] : s.substring(1, s.length - 1).split(',').map(parseBoolOrNull);
export let parseNumberArray = (s: string): (number | null)[] => s == "{}" ? [] : s.substring(1, s.length - 1).split(',').map(parseNumberOrNull);
export let parseNumberArrayWithValidation = (s: string[]) => s.map(parseNumberWithValidation);
export let parseDateArray = (s: string): (Date | null)[] => s == "{}" ? [] : s.substring(1, s.length - 1).split(',').map(d => d == 'NULL' ? null : moment(d.substring(1, d.length - 1)).toDate());
export let parseJsonArray = (s: string): (Object | null)[] => {
    let vals = parseArray(s);
    return vals.map(s2 => typeof s2 === 'string' ? JSON.parse(s2) : s2);
};

function unescapeString(s: string): string {
    return s.slice(1, s.length - 1)    // cut the first and the last "
        .replace(/\\"/g, '"')          // \" -> "
        .replace(/\\\\/g, '\\')        // \\ -> \
}
