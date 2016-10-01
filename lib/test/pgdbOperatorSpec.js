"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const pgdb_1 = require("../pgdb");
var util = require('util');
function w(func) {
    return function (done) {
        return (() => __awaiter(this, void 0, void 0, function* () {
            yield func();
            return done();
        }))().catch(e => {
            console.error(e.message, e.stack);
            expect(false).toBeTruthy();
            done();
        });
    };
}
describe("pgdb", () => {
    var pgdb;
    var schema = 'pgdb_test';
    var table;
    beforeAll(w(() => __awaiter(this, void 0, void 0, function* () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 800000;
        /**
         * Using environment variables, e.g.
         * PGUSER (defaults USER env var, so optional)
         * PGDATABASE (defaults USER env var, so optional)
         * PGPASSWORD
         * PGPORT
         * etc...
         */
        pgdb = yield pgdb_1.PgDb.connect({ connectionString: "postgres://" });
        yield pgdb.run('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE ');
        yield pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        yield pgdb.run('SET search_path TO "' + schema + '"');
        yield pgdb.execute('spec/resources/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        yield pgdb.reload();
        //pgdb.setLogger(console);
        table = pgdb.schemas[schema]['users'];
    })));
    beforeEach(w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.run('DELETE FROM ' + table);
    })));
    it("Testing Array operators", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: 'S', favourites: ['sport'] });
        yield table.insert({ name: 'SF', favourites: ['sport', 'food'] });
        yield table.insert({ name: 'TF', favourites: ['tech', 'food'] });
        let res;
        res = yield table.find({ 'favourites': 'sport' }, { fields: ['name'] }); //=> 'sport' = ANY("favourites")
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield table.find({ 'favourites': ['sport', 'food'] }, { fields: ['name'] }); //=> favourites = '{sport,food}'
        expect(res.map(r => r.name)).toEqual(['SF']);
        res = yield table.find({ 'favourites @>': ['sport'] }); //contains
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield table.find({ 'favourites <@': ['sport', 'food', 'tech'] }); //contained by
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);
        res = yield table.find({ 'favourites &&': ['sport', 'music'] }); //overlap
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);
        res = yield table.find({ 'favourites !=': ['sport'] }); //
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    })));
    it("Testing Jsonb list selector operators", w(() => __awaiter(this, void 0, void 0, function* () {
        //@formatter:off
        yield table.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        yield table.insert({ name: 'Anybody', jsonList: ['art', 'age'] });
        yield table.insert({ name: 'Nobody', jsonList: ['neverending', 'nearby'] });
        yield table.insert({ name: 'Noone', jsonList: null, });
        yield table.insert({ name: 'Anonymous', jsonList: [] });
        //@formatter:on
        let res;
        res = yield table.find({ 'jsonList @>': ['sport'] }, { fields: ['name'] }); //=>
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ 'jsonList <@': ['sport', 'tech', 'season'] }, { fields: ['name'] }); //=>
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anonymous']);
        res = yield table.find({ 'jsonList ?': 0 }, { fields: ['name'] }); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);
        res = yield table.find({ 'jsonList ?': '0' }, { fields: ['name'] }); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);
        res = yield table.find({ 'jsonList ->> 0': 'art' }, { fields: ['name'] }); //=> the first element is
        expect(res.map(r => r.name)).toEqual(['Anybody']);
        res = yield table.find({ "jsonList ->> '0'": 'art' }, { fields: ['name'] }); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);
    })));
    it("Testing Jsonb list update", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: 'Somebody', jsonList: ['sport', 'season'] });
        yield table.update({ name: 'Somebody' }, { jsonList: [{ name: 'sport' }, { name: 'season' }] });
        let res = yield table.findAll();
        expect(res.map(r => r.jsonList.map(e => e.name))[0]).toEqual(['sport', 'season']);
    })));
    it("Testing Jsonb list operators", w(() => __awaiter(this, void 0, void 0, function* () {
        //@formatter:off
        yield table.insert({ name: 'Somebody', jsonObject: { realName: 'somebody', webpage: 's.com' } });
        yield table.insert({ name: 'Anybody', jsonObject: { realName: 'anybody', webpage: 'a.com' } });
        yield table.insert({ name: 'Nobody', jsonObject: { realName: 'nobody', email: 'nobody@nowhere.com' } });
        yield table.insert({ name: 'Noone', jsonObject: null });
        yield table.insert({ name: 'Anonymous', jsonObject: {} });
        //@formatter:on
        let res;
        res = yield table.find({ 'jsonObject ?': 'email' }, { fields: ['name'] }); //=> has the key ..
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = yield table.find({ 'jsonObject ?&': ['email', 'realName'] }, { fields: ['name'] }); //=> has all key ..
        expect(res.map(r => r.name)).toEqual(['Nobody']);
        res = yield table.find({ 'jsonObject ?|': ['email', 'webpage'] }, { fields: ['name'] }); //=> has any of the key..
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = yield table.find({ 'jsonObject @>': { realName: 'somebody' } }, { fields: ['name'] }); //=> contains substructure
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ 'jsonObject ->> realName': 'somebody' }, { fields: ['name'] }); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ 'jsonObject ->> \'realName\'': 'somebody' }, { fields: ['name'] }); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ '"jsonObject" ->> \'realName\'': 'somebody' }, { fields: ['name'] }); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ 'jsonObject ->> realName': ['somebody', 'anybody'] }, { fields: ['name'] }); //=> has the key + in array
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody']);
        res = yield table.find({ 'jsonObject ->> realName like': '%body' }, { fields: ['name'] }); //=> has the key + like
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
        res = yield table.find({ 'jsonObject ->> realName ~~': '%body' }, { fields: ['name'] }); //=> has the key + like
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);
    })));
    it("Test deep jsonb @>", w(() => __awaiter(this, void 0, void 0, function* () {
        //@formatter:off
        yield table.insert({ name: 'Somebody', jsonObject: { service: { indexing: { by: [1, 2, 3] }, database: true }, paid: true } });
        yield table.insert({ name: 'Anybody', jsonList: [{ realName: 'anyone' }, { realName: 'anybody' }] });
        //@formatter:on
        let res;
        res = yield table.find({ 'jsonObject @>': { service: { indexing: { by: [1] } }, paid: true } });
        expect(res.map(r => r.name)).toEqual(['Somebody']);
        res = yield table.find({ 'jsonList @>': [{ realName: 'anybody' }] });
        expect(res.map(r => r.name)).toEqual(['Anybody']);
    })));
    it("Testing is (not) null", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: 'Noone', jsonObject: null });
        yield table.insert({ name: 'Anonymous', jsonObject: {} });
        let count;
        count = yield table.count({ 'jsonObject !': null });
        expect(count).toEqual(1);
        count = yield table.count({ 'jsonObject': null });
        expect(count).toEqual(1);
        count = yield table.count({});
        expect(count).toEqual(2);
    })));
    it("Test regexp ~,~*,!~,!~*", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: "All' o Phoibe" });
        yield table.insert({ name: "I've got that tune" });
        let res = yield table.find({ 'name ~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield table.find({ 'name ~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);
        res = yield table.find({ 'name !~': "\\so\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
        res = yield table.find({ 'name !~*': "\\sO\\s" });
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);
    })));
    it("Test like ~~, like, ~~*, ilike, !~~, not like, !~~*, not ilike", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: 'Iced lemonade' });
        yield table.insert({ name: 'Cucumber pear juice' });
        let res;
        res = yield table.find({ 'name ~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield table.find({ 'name like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield table.find({ 'name ~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield table.find({ 'name ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield table.find({ 'name !~~': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield table.find({ 'name not like': '%lemon%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield table.find({ 'name !~~*': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
        res = yield table.find({ 'name not ilike': '%LEMON%' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    })));
    it("Special added operators =*, icontains", w(() => __awaiter(this, void 0, void 0, function* () {
        yield table.insert({ name: 'Iced lemonade' });
        yield table.insert({ name: 'Cucumber pear juice', textList: ['good', 'better', 'best'] });
        let res;
        res = yield table.find({ 'name =*': 'ICED LEMONADE' });
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);
        res = yield table.find({ 'textList icontains': 'GOOD' });
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    })));
});
/*

 console.log('--- TEST 17 jsonb [{}] update ---------');
 res = await pdb.schemas['dev']['fsZones'].updateAndGetOne({id:14}, {zoneAdmins:[], buildings:[]});
 if (!Array.isArray(res.buildings) || !Array.isArray(res.zoneAdmins)) {
 throw Error('both should be an array!');
 }
 console.log(util.inspect(res, false, null));

 console.log('--- TEST 18 array<int> ---------');
 dbTable = pdb.schemas['dev']['fsZones'];
 res = await dbTable.findAll();
 console.log(util.inspect(res, false, null));


 console.log('--- TEST 20 parsing array fields ----------');
 res = await pdb.schemas['dev']['chemicals'].updateAndGetOne({id:167}, {extMedia:["test",'a b', 'c,d', '"e,f"','', null, null]});
 console.log(res);


 await pdb.close();
 console.log('end');

 })().catch(e => console.error(e.message, e.stack));
 */
/**
 * {,ads,"asdf""fd,",",3,"   "}
 *
 s = ',ads,"asdf""fd,",",3,"   "';
 e =
 e.exec(s)
 */
function parseComplexTypeArray(str) {
    let list = JSON.parse('[' + str.substring(1, str.length - 1) + ']');
    let result = [];
    for (let elementStr of list) {
        result.push(parseComplexType(elementStr));
    }
    return result;
}
function parseComplexType(str) {
    //cut of '(', ')'
    str = str.substring(1, str.length - 1);
    let e = /"((?:[^"]|"")*)"(?:,|$)|([^,]*)(?:,|$)/g;
    let valList = [];
    let parsingResult;
    let valStr;
    let hasNextValue;
    /**
     * parsingResult.index<str.length check for finish is not reliable
     * as if the last value is null it goes undetected, e.g. (,,)
     */
    do {
        parsingResult = e.exec(str);
        valStr = (parsingResult[0] == '' || parsingResult[0] == ',' || parsingResult[2] == 'null') ? null : parsingResult[1] || parsingResult[2];
        if (parsingResult[0] == '"",' || parsingResult[0] == '""') {
            valStr = '';
        }
        valList.push(valStr ? valStr.replace(/""/g, '"') : valStr);
        hasNextValue = parsingResult[0].substring(parsingResult[0].length - 1, parsingResult[0].length) == ',';
    } while (hasNextValue);
    return valList;
}
//# sourceMappingURL=pgdbOperatorSpec.js.map