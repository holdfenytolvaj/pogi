import { PgDb } from "./pgDb.js";
describe("pgdb", () => {
    let pgdb;
    let schema = 'pgdb_test';
    let tableUsers;
    let viewUsers;
    beforeAll(async () => {
        try {
            pgdb = await PgDb.connect({ connectionString: "postgres://" });
        }
        catch (e) {
            console.error("connection failed! Are you specified PGUSER/PGDATABASE/PGPASSWORD correctly?");
            console.error(e);
            process.exit(1);
        }
        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        await pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        await pgdb.reload();
        pgdb.setLogger(console);
        tableUsers = pgdb.schemas[schema]['users'];
        viewUsers = pgdb.schemas[schema]['users_view'];
        return Promise.resolve();
    });
    beforeEach(async () => {
        await tableUsers.run('DELETE FROM ' + tableUsers);
    });
    afterAll(async () => {
        await pgdb.close();
    });
    it("Testing Array operators", async () => {
        await tableUsers.insert({ name: 'S', favourites: ['sport'] });
        await tableUsers.insert({ name: 'SF', favourites: ['sport', 'food'] });
        await tableUsers.insert({ name: 'TF', favourites: ['tech', 'food'] });
        let res;
        res = await tableUsers.find({ 'favourites': 'sport' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await tableUsers.find({ 'favourites': ['sport', 'food'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['SF']);
        res = await tableUsers.find({ 'favourites @>': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await tableUsers.find({ 'favourites <@': ['sport', 'food', 'tech'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);
        res = await tableUsers.find({ 'favourites &&': ['sport', 'music'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await tableUsers.find({ 'favourites !=': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    });
    it("Testing Array operators on view", async () => {
        await viewUsers.insert({ name: 'S', favourites: ['sport'] });
        await viewUsers.insert({ name: 'SF', favourites: ['sport', 'food'] });
        await viewUsers.insert({ name: 'TF', favourites: ['tech', 'food'] });
        let res;
        res = await viewUsers.find({ 'favourites': 'sport' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await viewUsers.find({ 'favourites': ['sport', 'food'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['SF']);
        res = await viewUsers.find({ 'favourites @>': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await viewUsers.find({ 'favourites <@': ['sport', 'food', 'tech'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);
        res = await viewUsers.find({ 'favourites &&': ['sport', 'music'] });
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = await viewUsers.find({ 'favourites !=': ['sport'] });
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    });
    it("Searching in elements in jsonList", async () => {
        await tableUsers.insert({ name: 'Medium and high risk', jsonList: [{ risk: 'H' }, { risk: 'M' }] });
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
        res = await tableUsers.find(query1, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        res = await tableUsers.find(query2, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        res = await tableUsers.find(query3, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
    });
    it("Free text search", async () => {
        await tableUsers.insert({ name: 'Medium and high risk', jsonList: [{ name: "The return of the Jedi" }] });
        let res;
        for (let searchCol of ['"name"||"jsonList" @@', 'tsv @@']) {
            res = await tableUsers.find({ [searchCol]: 'risk & return' }, { fields: ['name'] });
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
            res = await tableUsers.find({ [searchCol]: 'risk & future' }, { fields: ['name'] });
            expect(res.length).toEqual(0);
            res = await tableUsers.find({
                [searchCol]: {
                    lang: 'english',
                    query: 'risk & return'
                }
            }, { fields: ['name'] });
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        }
    });
    it("Testing Jsonb list selector operators", async () => {
        await tableUsers.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        await tableUsers.insert({ name: 'Anybody', jsonList: ['art', 'age'] });
        await tableUsers.insert({ name: 'Nobody', jsonList: ['neverending', 'nearby'] });
        await tableUsers.insert({ name: 'Noone', jsonList: null, });
        await tableUsers.insert({ name: 'Anonymous', jsonList: [] });
        await tableUsers.insert({ name: 'Obi1', jsonObject: { a: { b: 3 } } });
        await tableUsers.insert({ name: 'Obi2', jsonObject: { a: { b: [3, 4, 5, 6] }, d: 'c', g: 'e' } });
        let res;
        res = await tableUsers.find({ '"jsonObject" ?|': ['d', 'f'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
        res = await tableUsers.find({ 'jsonList @>': ['sport'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ 'jsonList <@': ['sport', 'tech', 'season'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anonymous']);
        res = await tableUsers.find({ 'jsonList ?': 0 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = await tableUsers.find({ 'jsonList ?': '0' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = await tableUsers.find({ 'jsonObject -> a': { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonObject -> 'a'": { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ 'jsonList ->> 0': 'art' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Anybody']);
        res = await tableUsers.find({ 'jsonObject ->> a': '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonObject ->> 'a'": '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonList ->> '0'": 'art' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual([]);
        res = await tableUsers.find({ "jsonObject #> {a}": { b: 3 } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonObject #>> {a}": '{"b": 3}' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonObject #>> {a,b}": 3 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi1']);
        res = await tableUsers.find({ "jsonObject #>> {a,b,1}": 4 }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
        res = await tableUsers.find({ "jsonObject #>> {a,b,1}": '4' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Obi2']);
    });
    it("Testing Jsonb list update", async () => {
        await tableUsers.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        await tableUsers.update({ name: 'Somebody' }, { jsonList: [{ name: 'sport' }, { name: 'season' }] });
        let res = await tableUsers.findAll();
        expect(res.map(r => r.jsonList.map((e) => e.name))[0]).toEqual(['sport', 'season']);
    });
    it("Testing Jsonb list operators", async () => {
        await tableUsers.insert({ name: 'Somebody', jsonObject: { realName: 'somebody', webpage: 's.com' } });
        await tableUsers.insert({ name: 'Anybody', jsonObject: { realName: 'anybody', webpage: 'a.com' } });
        await tableUsers.insert({ name: 'Nobody', jsonObject: { realName: 'nobody', email: 'nobody@nowhere.com' } });
        await tableUsers.insert({ name: 'Noone', jsonObject: null });
        await tableUsers.insert({ name: 'Anonymous', jsonObject: {} });
        let res;
        res = await tableUsers.find({ 'jsonObject ?': 'email' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = await tableUsers.find({ 'jsonObject ?&': ['email', 'realName'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = await tableUsers.find({ 'jsonObject ?|': ['email', 'webpage'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = await tableUsers.find({ 'jsonObject @>': { realName: 'somebody' } }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ 'jsonObject ->> realName': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ 'jsonObject ->> \'realName\'': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ '"jsonObject" ->> \'realName\'': 'somebody' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ 'jsonObject ->> realName': ['somebody', 'anybody'] }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody']);
        res = await tableUsers.find({ 'jsonObject ->> realName like': '%body' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = await tableUsers.find({ 'jsonObject ->> realName ~~': '%body' }, { fields: ['name'] });
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
    });
    it("Test deep jsonb @>", async () => {
        await tableUsers.insert({ name: 'Somebody', jsonObject: { service: { indexing: { by: [1, 2, 3] }, database: true }, paid: true } });
        await tableUsers.insert({ name: 'Anybody', jsonList: [{ realName: 'anyone' }, { realName: 'anybody' }] });
        let res;
        res = await tableUsers.find({ 'jsonObject @>': { service: { indexing: { by: [1] } }, paid: true } });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = await tableUsers.find({ 'jsonList @>': [{ realName: 'anybody' }] });
        expect(res.map(r => r.name)).toEqual(['Anybody']);
    });
    it("Testing is (not) null", async () => {
        await tableUsers.insert({ name: 'Noone', jsonObject: null });
        await tableUsers.insert({ name: 'Anonymous', jsonObject: {} });
        let count;
        count = await tableUsers.count({ 'jsonObject !': null });
        expect(count).toEqual(1);
        count = await tableUsers.count({ 'jsonObject': null });
        expect(count).toEqual(1);
        count = await tableUsers.count({});
        expect(count).toEqual(2);
    });
    it("Test regexp ~,~*,!~,!~*", async () => {
        await tableUsers.insert({ name: "All' o Phoibe" });
        await tableUsers.insert({ name: "I've got that tune" });
        let res = await tableUsers.find({ 'name ~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = await tableUsers.find({ 'name ~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = await tableUsers.find({ 'name !~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
        res = await tableUsers.find({ 'name !~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
    });
    it("Test regexp " +
        "~/~* ANY" +
        "!~/!~* ALL", async () => {
        await tableUsers.insert({ name: "All' o Phoibe" });
        await tableUsers.insert({ name: "I've got that tune" });
        let res = await tableUsers.find({ 'name ~': ["\\so\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = await tableUsers.find({ 'name ~*': ["\\sO\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = await tableUsers.find({ 'name !~': ["\\so\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
        res = await tableUsers.find({ 'name !~*': ["\\sO\\s", '\\d+'] });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
    });
    it("Test like ~~, like, ~~*, ilike, !~~, not like, !~~*, not ilike", async () => {
        await tableUsers.insert({ name: 'Iced lemonade' });
        await tableUsers.insert({ name: 'Cucumber pear juice' });
        let res;
        res = await tableUsers.find({ 'name ~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name ~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name !~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name not like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name !~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name not ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    });
    it("Test " +
        "like/~~/ilike/~~* ANY(), " +
        "not like/!~~/not ilike/!~~* ALL()", async () => {
        await tableUsers.insert({ name: 'Iced lemonade' });
        await tableUsers.insert({ name: 'Cucumber pear juice' });
        let res;
        res = await tableUsers.find({ 'name ~~': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name like': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name ~~*': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name ilike': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'name !~~': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name not like': ['BB', '%lemon%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name !~~*': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'name not ilike': ['bb', '%LEMON%'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    });
    it("Special added operators =*, icontains", async () => {
        await tableUsers.insert({ name: 'Iced lemonade' });
        await tableUsers.insert({ name: 'Cucumber pear juice', textList: ['good', 'better', 'best'] });
        let res;
        res = await tableUsers.find({ 'name =*': 'ICED LEMONADE' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = await tableUsers.find({ 'textList icontains': 'GOOD' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'textList =*': 'GOOD' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = await tableUsers.find({ 'textList &&*': ['GOOD', 'Bad'] });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    });
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