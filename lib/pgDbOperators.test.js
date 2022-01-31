"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pgDb_1 = require("./pgDb");
describe("pgdb", () => {
    let pgdb;
    let schema = 'pgdb_test';
    let tableUsers;
    let viewUsers;
    beforeAll(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        try {
            pgdb = yield pgDb_1.PgDb.connect({ connectionString: "postgres://" });
        }
        catch (e) {
            console.error("connection failed! Are you specified PGUSER/PGDATABASE/PGPASSWORD correctly?");
            console.error(e);
            process.exit(1);
        }
        yield pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        yield pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        yield pgdb.reload();
        pgdb.setLogger(console);
        tableUsers = pgdb.schemas[schema]['users'];
        viewUsers = pgdb.schemas[schema]['users_view'];
        return Promise.resolve();
    }));
    beforeEach(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.run('DELETE FROM ' + tableUsers);
    }));
    afterAll(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield pgdb.close();
    }));
    it("Testing Array operators", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'S', favourites: ['sport'] });
        yield tableUsers.insert({ name: 'SF', favourites: ['sport', 'food'] });
        yield tableUsers.insert({ name: 'TF', favourites: ['tech', 'food'] });
        let res;
        res = yield tableUsers.find({ 'favourites': 'sport' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield tableUsers.find({ 'favourites': ['sport', 'food'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['SF']);
        res = yield tableUsers.find({ 'favourites @>': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield tableUsers.find({ 'favourites <@': ['sport', 'food', 'tech'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);
        res = yield tableUsers.find({ 'favourites &&': ['sport', 'music'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield tableUsers.find({ 'favourites !=': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    }));
    it("Testing Array operators on view", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield viewUsers.insert({ name: 'S', favourites: ['sport'] });
        yield viewUsers.insert({ name: 'SF', favourites: ['sport', 'food'] });
        yield viewUsers.insert({ name: 'TF', favourites: ['tech', 'food'] });
        let res;
        res = yield viewUsers.find({ 'favourites': 'sport' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield viewUsers.find({ 'favourites': ['sport', 'food'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['SF']);
        res = yield viewUsers.find({ 'favourites @>': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield viewUsers.find({ 'favourites <@': ['sport', 'food', 'tech'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);
        res = yield viewUsers.find({ 'favourites &&': ['sport', 'music'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield viewUsers.find({ 'favourites !=': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    }));
    it("Searching in elements in jsonList", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Medium and high risk', jsonList: [{ risk: 'H' }, { risk: 'M' }] });
        let query1 = {
            or: [{ '"jsonList" @>': [{ "risk": "H" }] }, { '"jsonList" @>': [{ "risk": "L" }] }]
        };
        let query2 = {
            or: [{ 'jsonList @>': [{ "risk": "H" }] }, { 'jsonList @>': [{ "risk": "L" }] }]
        };
        let query3 = {
            or: [{ 'jsonList @>': '[{"risk": "H"}]' }, { 'jsonList @>': '[{"risk": "L"}]' }]
        };
        let res;
        res = yield tableUsers.find(query1, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        res = yield tableUsers.find(query2, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        res = yield tableUsers.find(query3, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
    }));
    it("Free text search", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Medium and high risk', jsonList: [{ name: "The return of the Jedi" }] });
        let res;
        for (let searchCol of ['"name"||"jsonList" @@', 'tsv @@']) {
            res = yield tableUsers.find({ [searchCol]: 'risk & return' }, { fields: ['name'] });
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
            res = yield tableUsers.find({ [searchCol]: 'risk & future' }, { fields: ['name'] });
            expect(res.length).toEqual(0);
            res = yield tableUsers.find({
                [searchCol]: {
                    lang: 'english',
                    query: 'risk & return'
                }
            }, { fields: ['name'] });
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        }
    }));
    it("Testing Jsonb list selector operators", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        yield tableUsers.insert({ name: 'Anybody', jsonList: ['art', 'age'] });
        yield tableUsers.insert({ name: 'Nobody', jsonList: ['neverending', 'nearby'] });
        yield tableUsers.insert({ name: 'Noone', jsonList: null, });
        yield tableUsers.insert({ name: 'Anonymous', jsonList: [] });
        yield tableUsers.insert({ name: 'Obi1', jsonObject: { a: { b: 3 } } });
        yield tableUsers.insert({ name: 'Obi2', jsonObject: { a: { b: [3, 4, 5, 6] }, d: 'c', g: 'e' } });
        let res;
        res = yield tableUsers.find({ '"jsonObject" ?|': ['d', 'f'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
        res = yield tableUsers.find({ 'jsonList @>': ['sport'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ 'jsonList <@': ['sport', 'tech', 'season'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anonymous']);
        res = yield tableUsers.find({ 'jsonList ?': 0 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = yield tableUsers.find({ 'jsonList ?': '0' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = yield tableUsers.find({ 'jsonObject -> a': { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonObject -> 'a'": { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ 'jsonList ->> 0': 'art' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Anybody']);
        res = yield tableUsers.find({ 'jsonObject ->> a': '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonObject ->> 'a'": '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonList ->> '0'": 'art' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = yield tableUsers.find({ "jsonObject #> {a}": { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonObject #>> {a}": '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonObject #>> {a,b}": 3 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = yield tableUsers.find({ "jsonObject #>> {a,b,1}": 4 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
        res = yield tableUsers.find({ "jsonObject #>> {a,b,1}": '4' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
    }));
    it("Testing Jsonb list update", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        yield tableUsers.update({ name: 'Somebody' }, { jsonList: [{ name: 'sport' }, { name: 'season' }] });
        let res = yield tableUsers.findAll();
        expect(res.map(r => r.jsonList.map((e) => e.name))[0]).toEqual(['sport', 'season']);
    }));
    it("Testing Jsonb list operators", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Somebody', jsonObject: { realName: 'somebody', webpage: 's.com' } });
        yield tableUsers.insert({ name: 'Anybody', jsonObject: { realName: 'anybody', webpage: 'a.com' } });
        yield tableUsers.insert({ name: 'Nobody', jsonObject: { realName: 'nobody', email: 'nobody@nowhere.com' } });
        yield tableUsers.insert({ name: 'Noone', jsonObject: null });
        yield tableUsers.insert({ name: 'Anonymous', jsonObject: {} });
        let res;
        res = yield tableUsers.find({ 'jsonObject ?': 'email' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = yield tableUsers.find({ 'jsonObject ?&': ['email', 'realName'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = yield tableUsers.find({ 'jsonObject ?|': ['email', 'webpage'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = yield tableUsers.find({ 'jsonObject @>': { realName: 'somebody' } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ 'jsonObject ->> realName': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ 'jsonObject ->> \'realName\'': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ '"jsonObject" ->> \'realName\'': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ 'jsonObject ->> realName': ['somebody', 'anybody'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody']);
        res = yield tableUsers.find({ 'jsonObject ->> realName like': '%body' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = yield tableUsers.find({ 'jsonObject ->> realName ~~': '%body' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
    }));
    it("Test deep jsonb @>", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Somebody', jsonObject: { service: { indexing: { by: [1, 2, 3] }, database: true }, paid: true } });
        yield tableUsers.insert({ name: 'Anybody', jsonList: [{ realName: 'anyone' }, { realName: 'anybody' }] });
        let res;
        res = yield tableUsers.find({ 'jsonObject @>': { service: { indexing: { by: [1] } }, paid: true } });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield tableUsers.find({ 'jsonList @>': [{ realName: 'anybody' }] });
        expect(res.map(r => r.name)).toEqual(['Anybody']);
    }));
    it("Testing is (not) null", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Noone', jsonObject: null });
        yield tableUsers.insert({ name: 'Anonymous', jsonObject: {} });
        let count;
        count = yield tableUsers.count({ 'jsonObject !': null });
        expect(count).toEqual(1);
        count = yield tableUsers.count({ 'jsonObject': null });
        expect(count).toEqual(1);
        count = yield tableUsers.count({});
        expect(count).toEqual(2);
    }));
    it("Test regexp ~,~*,!~,!~*", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: "All' o Phoibe" });
        yield tableUsers.insert({ name: "I've got that tune" });
        let res = yield tableUsers.find({ 'name ~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield tableUsers.find({ 'name ~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield tableUsers.find({ 'name !~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
        res = yield tableUsers.find({ 'name !~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
    }));
    it("Test regexp " +
        "~/~* ANY" +
        "!~/!~* ALL", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: "All' o Phoibe" });
        yield tableUsers.insert({ name: "I've got that tune" });
        let res = yield tableUsers.find({ 'name ~': ["\\so\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield tableUsers.find({ 'name ~*': ["\\sO\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield tableUsers.find({ 'name !~': ["\\so\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
        res = yield tableUsers.find({ 'name !~*': ["\\sO\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
    }));
    it("Test like ~~, like, ~~*, ilike, !~~, not like, !~~*, not ilike", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Iced lemonade' });
        yield tableUsers.insert({ name: 'Cucumber pear juice' });
        let res;
        res = yield tableUsers.find({ 'name ~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name ~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name !~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name not like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name !~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name not ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    }));
    it("Test " +
        "like/~~/ilike/~~* ANY(), " +
        "not like/!~~/not ilike/!~~* ALL()", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Iced lemonade' });
        yield tableUsers.insert({ name: 'Cucumber pear juice' });
        let res;
        res = yield tableUsers.find({ 'name ~~': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name like': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name ~~*': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name ilike': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'name !~~': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name not like': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name !~~*': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'name not ilike': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    }));
    it("Special added operators =*, icontains", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableUsers.insert({ name: 'Iced lemonade' });
        yield tableUsers.insert({ name: 'Cucumber pear juice', textList: ['good', 'better', 'best'] });
        let res;
        res = yield tableUsers.find({ 'name =*': 'ICED LEMONADE' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield tableUsers.find({ 'textList icontains': 'GOOD' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'textList =*': 'GOOD' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield tableUsers.find({ 'textList &&*': ['GOOD', 'Bad'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    }));
});
function parseComplexTypeArray(str) {
    let list = JSON.parse('[' + str.substring(1, str.length - 1) + ']');
    let result = [];
    for (let elementStr of list) {
        result.push(parseComplexType(elementStr));
    }
    return result;
}
function parseComplexType(str) {
    str = str.substring(1, str.length - 1);
    let e = /"((?:[^"]|"")*)"(?:,|$)|([^,]*)(?:,|$)/g;
    let valList = [];
    let parsingResult;
    let valStr;
    let hasNextValue;
    do {
        parsingResult = e.exec(str);
        if (!parsingResult)
            break;
        valStr = (parsingResult[0] == '' || parsingResult[0] == ',' || parsingResult[2] == 'null') ? null : parsingResult[1] || parsingResult[2];
        if (parsingResult[0] == '"",' || parsingResult[0] == '""') {
            valStr = '';
        }
        valList.push(valStr ? valStr.replace(/""/g, '"') : valStr);
        hasNextValue = parsingResult[0].substring(parsingResult[0].length - 1, parsingResult[0].length) == ',';
    } while (hasNextValue);
    return valList;
}
//# sourceMappingURL=pgDbOperators.test.js.map