/// <reference types="jasmine"/>
import {PgDb} from "../pgDb";
import {PgTable} from "../pgTable";

const util = require('util');

function w(func) {
    return function (done) {
        return (async () => {
            try {
                await func();
            } catch (e) {
                console.log('------------------------------');
                console.error(e.message, e.stack);
                console.log('------------------------------');
                expect('Exception: ' + e.message).toBeFalsy();
            }
            return done();
        })();
    }
}

describe("pgdb", () => {
    let pgdb: PgDb;
    let schema = 'pgdb_test';
    let tableUsers: PgTable<any>;
    let viewUsers: PgTable<any>;

    beforeAll(w(async () => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 800000;

        /**
         * Using environment variables, e.g.
         * PGUSER (defaults USER env var, so optional)
         * PGDATABASE (defaults USER env var, so optional)
         * PGPASSWORD
         * PGPORT
         * etc...
         */
        try {
            pgdb = await PgDb.connect({connectionString: "postgres://"});
        } catch (e) {
            console.error("connection failed! Are you specified PGUSER/PGDATABASE/PGPASSWORD correctly?");
            console.error(e);
            process.exit(1);
        }
        //await pgdb.run('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE ');
        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        await pgdb.execute('spec/resources/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        await pgdb.reload();

        pgdb.setLogger(console);
        tableUsers = pgdb.schemas[schema]['users'];
        viewUsers = pgdb.schemas[schema]['users_view'];

        return Promise.resolve();
    }));

    beforeEach(w(async () => {
        await tableUsers.run('DELETE FROM ' + tableUsers);
    }));

    it("Testing Array operators", w(async () => {
        await tableUsers.insert({name: 'S', favourites: ['sport']});
        await tableUsers.insert({name: 'SF', favourites: ['sport', 'food']});
        await tableUsers.insert({name: 'TF', favourites: ['tech', 'food']});

        let res;

        res = await tableUsers.find({'favourites': 'sport'}, {fields: ['name']}); //=> 'sport' = ANY("favourites")
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await tableUsers.find({'favourites': ['sport', 'food']}, {fields: ['name']}); //=> favourites = '{sport,food}'
        expect(res.map(r => r.name)).toEqual(['SF']);

        res = await tableUsers.find({'favourites @>': ['sport']}); //contains
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await tableUsers.find({'favourites <@': ['sport', 'food', 'tech']});//contained by
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);

        res = await tableUsers.find({'favourites &&': ['sport', 'music']});//overlap
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await tableUsers.find({'favourites !=': ['sport']});//
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    }));

    it("Testing Array operators on view", w(async () => {
        await viewUsers.insert({name: 'S', favourites: ['sport']});
        await viewUsers.insert({name: 'SF', favourites: ['sport', 'food']});
        await viewUsers.insert({name: 'TF', favourites: ['tech', 'food']});

        let res;

        res = await viewUsers.find({'favourites': 'sport'}, {fields: ['name']}); //=> 'sport' = ANY("favourites")
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await viewUsers.find({'favourites': ['sport', 'food']}, {fields: ['name']}); //=> favourites = '{sport,food}'
        expect(res.map(r => r.name)).toEqual(['SF']);

        res = await viewUsers.find({'favourites @>': ['sport']}); //contains
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await viewUsers.find({'favourites <@': ['sport', 'food', 'tech']});//contained by
        expect(res.map(r => r.name)).toEqual(['S', 'SF', 'TF']);

        res = await viewUsers.find({'favourites &&': ['sport', 'music']});//overlap
        expect(res.map(r => r.name)).toEqual(['S', 'SF']);

        res = await viewUsers.find({'favourites !=': ['sport']});//
        expect(res.map(r => r.name)).toEqual(['SF', 'TF']);
    }));

    it("Searching in elements in jsonList", w(async () => {
        await tableUsers.insert({name: 'Medium and high risk', jsonList: [{risk: 'H'}, {risk: 'M'}]});

        let query1 = {
            or: [{'"jsonList" @>': [{"risk": "H"}]}, {'"jsonList" @>': [{"risk": "L"}]}]
        };
        let query2 = {
            or: [{'jsonList @>': [{"risk": "H"}]}, {'jsonList @>': [{"risk": "L"}]}]
        };
        let query3 = {
            or: [{'jsonList @>': '[{"risk": "H"}]'}, {'jsonList @>': '[{"risk": "L"}]'}]
        };

        let res;
        res = await tableUsers.find(query1, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);

        res = await tableUsers.find(query2, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);

        res = await tableUsers.find(query3, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
    }));

    it("Free text search", w(async () => {
        await tableUsers.insert({name: 'Medium and high risk', jsonList: [{name: "The return of the Jedi"}]});

        let res;
        for (let searchCol of ['"name"||"jsonList" @@', 'tsv @@']) {
            res = await tableUsers.find({[searchCol]: 'risk & return'}, {fields: ['name']});
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);

            res = await tableUsers.find({[searchCol]: 'risk & future'}, {fields: ['name']});
            expect(res.length).toEqual(0);

            res = await tableUsers.find({
                [searchCol]: {
                    lang: 'english',
                    query: 'risk & return'
                }
            }, {fields: ['name']});
            expect(res.map(r => r.name)).toEqual(['Medium and high risk']);
        }
    }));

    it("Testing Jsonb list selector operators", w(async () => {
        //@formatter:off
        await tableUsers.insert({ name: 'Somebody',  jsonList: ['sport', 'season'] });
        await tableUsers.insert({ name: 'Anybody',   jsonList: ['art', 'age'] });
        await tableUsers.insert({ name: 'Nobody',    jsonList: ['neverending', 'nearby'] });
        await tableUsers.insert({ name: 'Noone',     jsonList: null, });
        await tableUsers.insert({ name: 'Anonymous', jsonList: [] });
        await tableUsers.insert({ name: 'Obi1', jsonObject: {a:{b:3}}});
        await tableUsers.insert({ name: 'Obi2', jsonObject: {a:{b:[3,4,5,6]}} });
        //@formatter:on

        let res;
        res = await tableUsers.find({'jsonList @>': ['sport']}, {fields: ['name']}); //=>
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'jsonList <@': ['sport', 'tech', 'season']}, {fields: ['name']}); //=>
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anonymous']);

        res = await tableUsers.find({'jsonList ?': 0}, {fields: ['name']}); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);

        res = await tableUsers.find({'jsonList ?': '0'}, {fields: ['name']}); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);

        res = await tableUsers.find({'jsonObject -> a': {b: 3}}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonObject -> 'a'": {b: 3}}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({'jsonList ->> 0': 'art'}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Anybody']);

        res = await tableUsers.find({'jsonObject ->> a': '{"b": 3}'}, {fields: ['name']}); //->> return as a text
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonObject ->> 'a'": '{"b": 3}'}, {fields: ['name']}); //->> return as a text
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonList ->> '0'": 'art'}, {fields: ['name']}); //=> doesnt work
        expect(res.map(r => r.name)).toEqual([]);

        res = await tableUsers.find({"jsonObject #> {a}": {b: 3}}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonObject #>> {a}": '{"b": 3}'}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonObject #>> {a,b}": 3}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi1']);

        res = await tableUsers.find({"jsonObject #>> {a,b,1}": 4}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi2']);
        res = await tableUsers.find({"jsonObject #>> {a,b,1}": '4'}, {fields: ['name']});
        expect(res.map(r => r.name)).toEqual(['Obi2']);
    }));

    it("Testing Jsonb list update", w(async () => {
        await tableUsers.insert({name: 'Somebody', jsonList: ['sport', 'season']});
        await tableUsers.update({name: 'Somebody'}, {jsonList: [{name: 'sport'}, {name: 'season'}]});

        let res = await tableUsers.findAll();
        expect(res.map(r => r.jsonList.map(e => e.name))[0]).toEqual(['sport', 'season']);
    }));

    it("Testing Jsonb list operators", w(async () => {
        //@formatter:off
        await tableUsers.insert({ name: 'Somebody',  jsonObject: {realName: 'somebody', webpage: 's.com'} });
        await tableUsers.insert({ name: 'Anybody',   jsonObject: {realName: 'anybody', webpage: 'a.com'} });
        await tableUsers.insert({ name: 'Nobody',    jsonObject: {realName: 'nobody', email: 'nobody@nowhere.com'}});
        await tableUsers.insert({ name: 'Noone',     jsonObject: null});
        await tableUsers.insert({ name: 'Anonymous', jsonObject: {}});
        //@formatter:on
        let res;

        res = await tableUsers.find({'jsonObject ?': 'email'}, {fields: ['name']}); //=> has the key ..
        expect(res.map(r => r.name)).toEqual(['Nobody']);

        res = await tableUsers.find({'jsonObject ?&': ['email', 'realName']}, {fields: ['name']}); //=> has all key ..
        expect(res.map(r => r.name)).toEqual(['Nobody']);

        res = await tableUsers.find({'jsonObject ?|': ['email', 'webpage']}, {fields: ['name']}); //=> has any of the key..
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);

        res = await tableUsers.find({'jsonObject @>': {realName: 'somebody'}}, {fields: ['name']}); //=> contains substructure
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'jsonObject ->> realName': 'somebody'}, {fields: ['name']}); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'jsonObject ->> \'realName\'': 'somebody'}, {fields: ['name']}); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'"jsonObject" ->> \'realName\'': 'somebody'}, {fields: ['name']}); //=> has the key + equals to
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'jsonObject ->> realName': ['somebody', 'anybody']}, {fields: ['name']}); //=> has the key + in array
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody']);

        res = await tableUsers.find({'jsonObject ->> realName like': '%body'}, {fields: ['name']}); //=> has the key + like
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);

        res = await tableUsers.find({'jsonObject ->> realName ~~': '%body'}, {fields: ['name']}); //=> has the key + like
        expect(res.map(r => r.name)).toEqual(['Somebody', 'Anybody', 'Nobody']);

    }));

    it("Test deep jsonb @>", w(async () => {
        //@formatter:off
        await tableUsers.insert({ name: 'Somebody', jsonObject: {service: {indexing: {by: [1, 2, 3]}, database: true}, paid: true}});
        await tableUsers.insert({ name: 'Anybody',  jsonList: [{realName: 'anyone'}, {realName: 'anybody'}]});
        //@formatter:on

        let res;
        res = await tableUsers.find({'jsonObject @>': {service: {indexing: {by: [1]}}, paid: true}});
        expect(res.map(r => r.name)).toEqual(['Somebody']);

        res = await tableUsers.find({'jsonList @>': [{realName: 'anybody'}]});
        expect(res.map(r => r.name)).toEqual(['Anybody']);
    }))


    it("Testing is (not) null", w(async () => {
        await tableUsers.insert({name: 'Noone', jsonObject: null});
        await tableUsers.insert({name: 'Anonymous', jsonObject: {}});

        let count;

        count = await tableUsers.count({'jsonObject !': null});
        expect(count).toEqual(1);

        count = await tableUsers.count({'jsonObject': null});
        expect(count).toEqual(1);

        count = await tableUsers.count({});
        expect(count).toEqual(2);
    }));

    it("Test regexp ~,~*,!~,!~*", w(async () => {
        await tableUsers.insert({name: "All' o Phoibe"});
        await tableUsers.insert({name: "I've got that tune"});

        let res = await tableUsers.find({'name ~': "\\so\\s"});
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);

        res = await tableUsers.find({'name ~*': "\\sO\\s"});
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);

        res = await tableUsers.find({'name !~': "\\so\\s"});
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);

        res = await tableUsers.find({'name !~*': "\\sO\\s"});
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);

    }));

    it("Test regexp " +
        "~/~* ANY" +
        "!~/!~* ALL", w(async () => {
        await tableUsers.insert({name: "All' o Phoibe"});
        await tableUsers.insert({name: "I've got that tune"});

        let res = await tableUsers.find({'name ~': ["\\so\\s", '\\d+']});
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);

        res = await tableUsers.find({'name ~*': ["\\sO\\s", '\\d+']});
        expect(res.map(r => r.name)).toEqual(["All' o Phoibe"]);

        res = await tableUsers.find({'name !~': ["\\so\\s", '\\d+']});
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);

        res = await tableUsers.find({'name !~*': ["\\sO\\s", '\\d+']});
        expect(res.map(r => r.name)).toEqual(["I've got that tune"]);

    }));


    it("Test like ~~, like, ~~*, ilike, !~~, not like, !~~*, not ilike", w(async () => {
        await tableUsers.insert({name: 'Iced lemonade'});
        await tableUsers.insert({name: 'Cucumber pear juice'});
        let res;

        res = await tableUsers.find({'name ~~': '%lemon%'});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name like': '%lemon%'});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name ~~*': '%LEMON%'});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name ilike': '%LEMON%'});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name !~~': '%lemon%'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name not like': '%lemon%'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name !~~*': '%LEMON%'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name not ilike': '%LEMON%'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

    }));

    it("Test " +
        "like/~~/ilike/~~* ANY(), " +
        "not like/!~~/not ilike/!~~* ALL()", w(async () => {

        await tableUsers.insert({name: 'Iced lemonade'});
        await tableUsers.insert({name: 'Cucumber pear juice'});
        let res;

        res = await tableUsers.find({'name ~~': ['BB', '%lemon%']});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name like': ['BB', '%lemon%']});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name ~~*': ['bb', '%LEMON%']});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name ilike': ['bb', '%LEMON%']});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'name !~~': ['BB', '%lemon%']});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name not like': ['BB', '%lemon%']});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name !~~*': ['bb', '%LEMON%']});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'name not ilike': ['bb', '%LEMON%']});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    }));

    it("Special added operators =*, icontains", w(async () => {
        await tableUsers.insert({name: 'Iced lemonade'});
        await tableUsers.insert({name: 'Cucumber pear juice', textList: ['good', 'better', 'best']});
        let res;

        res = await tableUsers.find({'name =*': 'ICED LEMONADE'});
        expect(res.map(r => r.name)).toEqual(['Iced lemonade']);

        res = await tableUsers.find({'textList icontains': 'GOOD'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'textList =*': 'GOOD'});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);

        res = await tableUsers.find({'textList &&*': ['GOOD', 'Bad']});
        expect(res.map(r => r.name)).toEqual(['Cucumber pear juice']);
    }));


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
