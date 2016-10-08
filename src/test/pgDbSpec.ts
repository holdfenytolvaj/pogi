import {PgDb} from "../pgDb";
import {PgTable} from "../pgTable";
var util = require('util');

function w(func) {
    return function (done) {
        return (async() => {
            await func();
            return done();
        })().catch(e=>{
            console.error(e.message, e.stack);
            expect(false).toBeTruthy();
            done();
        })
    }
}


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
    str = str.substring(1, str.length-1);
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
        valStr = (parsingResult[0]=='' || parsingResult[0]==',' || parsingResult[2]=='null') ? null : parsingResult[1] || parsingResult[2] ;
        if (parsingResult[0]=='"",' || parsingResult[0]=='""') {
            valStr = '';
        }
        valList.push(valStr ? valStr.replace(/""/g,'"') : valStr);
        hasNextValue = parsingResult[0].substring(parsingResult[0].length-1,parsingResult[0].length)==',';
    } while (hasNextValue);
    return valList;
}


describe("pgdb", () => {
    var pgdb:PgDb;
    var schema = 'pgdb_test';
    var table:PgTable;

    beforeAll(w(async() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 800000;

        /**
         * Using environment variables, e.g.
         * PGUSER (defaults USER env var, so optional)
         * PGDATABASE (defaults USER env var, so optional)
         * PGPASSWORD
         * PGPORT
         * etc...
         */
        pgdb = await PgDb.connect({connectionString: "postgres://"});
        await pgdb.run('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE ');
        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        await pgdb.run('SET search_path TO "' + schema + '"');
        await pgdb.execute('spec/resources/init.sql', (cmd)=>cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        await pgdb.reload();

        pgdb.setLogger(console);
        table = pgdb.schemas[schema]['users'];
    }));

    beforeEach(w(async() => {
        await table.delete({});
    }));

    it("After adding parser should be able to parse complex type", w(async() => {
        await pgdb.setTypeParser('permissionForResourceType', (val) => parseComplexType(val));
        await pgdb.setTypeParser('_permissionForResourceType', (val) => val=="{}" ? [] : parseComplexTypeArray(val));
        await table.insert({
            name:'Piszkos Fred',
            permission:"(read,book)",
            permissionList:[
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'],
        });
        let pf = await table.findOne({name:'Piszkos Fred'});
        expect(pf.permission).toEqual(['read','book']);
        expect(pf.permissionList[0]).toEqual(['admin','chaos j ()",""j ,']);
        expect(pf.permissionList[1]).toEqual(['write','book']);
        expect(pf.permissionList[2]).toEqual(['write', null]);
        expect(pf.permissionList[3]).toEqual([null, ""]);
        expect(pf.permissionList[4]).toEqual([null, null]);
        expect(pf.permissionList[5]).toEqual(['write', null]);
        expect(pf.permissionList.length).toEqual(6);
    }));

    it("Complex type could be easily read and converted to json", w(async() => {
        await table.insert({
            name:'Elveszett cirkalo',
            permission:"(read,book)",
            permissionList:[
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'],
        });

        let res = await table.query(
            `SELECT to_json(permission) perjson, to_json("permissionList") perlistjson   
             FROM ${table}
             WHERE name='Elveszett cirkalo' `);
        expect(res[0].perjson).toEqual({permission:'read', resource:'book'});
        expect(res[0].perlistjson).toEqual([
            { permission: 'admin', resource: 'chaos j ()",""j ,' },
            { permission: 'write', resource: 'book' },
            { permission: 'write', resource: null },
            { permission: null, resource: '' },
            { permission: null, resource: null },
            { permission: 'write', resource: 'null' }
            ]);
    }));

    it("List for a non array column in the condition should be converted to 'IN Array'", w(async() => {
        await table.insert({name:'Fulig Jimmy', favourites:['sport']});
        await table.insert({name:'Vanek ur', favourites:['sport','food']});
        await table.insert({name:'Gorcsev Ivan', favourites:['tech','food']});

        let res1 = await table.findAll();
        let res2 = await table.find({id: res1.map(e=>e.id)});
        expect(res1.map(c=>c.id)).toEqual(res2.map(c=>c.id));
    }));

    it("Testing where function", w(async() => {
        await table.insert({name:'Fulig Jimmy', favourites:['sport']});
        await table.insert({name:'Vanek ur', favourites:['sport','food']});
        await table.insert({name:'Gorcsev Ivan', favourites:['tech','food','sport']});

        let res = await table.findWhere(':fav = ANY("favourites")', {fav:'sport'});
        expect(res.length).toEqual(3);
        res = await table.findWhere(':fav = ANY("favourites")', {fav:'food'});
        expect(res.length).toEqual(2);
        res = await table.findWhere(':fav = ANY("favourites")', {fav:'tech'});
        expect(res.length).toEqual(1);
    }));

    it("Ignore field with undefined value, but keep with null value",  w(async() => {
        await table.insert({name: 'A', numberList: [1, 2]});

        let res = await table.find({name: undefined});
        expect(res.length).toEqual(1);

        res = await table.find({name: null});
        expect(res.length).toEqual(0);

        let res2 = await table.updateAndGetOne({name: 'A'}, {numberList: undefined, favourites:['sport']});
        expect(res2.numberList).toEqual([1, 2]);

        res2 = await table.updateAndGetOne({name: 'A', numberList: undefined}, {numberList: null});
        expect(res2.numberList).toEqual(null);
    }));

    it("Test return only column values ",  w(async() => {
        await table.insert({name: 'A', membership:'gold'});
        await table.insert({name: 'B', membership:'gold'});
        await table.insert({name: 'C', membership:'bronze'});

        let res1 = await table.queryOneColumn("SELECT name || '_' || membership FROM " + table + " WHERE LENGTH(name)=1");
        expect(res1).toEqual(['A_gold', 'B_gold', 'C_bronze']);
    }));

    it("Test count ",  w(async() => {
        await table.insert({name: 'A', membership:'gold'});
        await table.insert({name: 'B', membership:'gold'});
        await table.insert({name: 'C', membership:'bronze'});

        let res1 = await table.count({membership:'gold'});
        expect(res1).toEqual(2);
    }));

    it("Test AND - OR ",  w(async() => {
        await table.insert({name: 'A', membership:'gold', favourites:['sport']});
        await table.insert([
            {name: 'BC', membership:'gold', favourites:['sport']},
            {name: 'D', membership:'bronze', favourites:['tech']},
            {name: 'E', membership:'bronze', favourites:['tech', 'food']}
            ]);

        let res;
        res = await table.find({'membership': "bronze", or: [{'name': 'BC'}, {favourites: 'food', name:'E'}]});
        expect(res.length).toEqual(1);

        res = await table.find({name:'A'});
        res = await table.count({
            and: [
                {or: [{name: ['A', 'BC']}, {'updated >': res[0].updated}]},
                {or: [{membership: 'bronze'},{'favourites @>': ['food']}]}
                ]
        });
        expect(res).toEqual(2);
    }));

    it("Test named parameters ",  w(async() => {
        await table.insert({name: 'A', membership:'gold'});
        await table.insert({name: 'B', membership:'gold'});
        await table.insert({name: 'C', membership:'bronze'});

        let res = await pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership" , {schema:schema, table:'users', membership:'gold'});
        expect(res[0].count).toEqual(2);
    }));

    it("text[]",  w(async() => {
        await table.insert({name: 'A', textList: ['good', 'better', 'best']});
        let res = await table.findOne({name:'A'});
        expect(res.textList).toEqual(['good', 'better', 'best']);
    }));

    it("integer[]",  w(async() => {
        await table.insert({name: 'A', numberList: [1,2,3]});
        let res = await table.findOne({name:'A'});
        expect(res.numberList).toEqual([1,2,3]);
    }));

    it("bigInt[]",  w(async() => {
        await table.insert({name: 'A', bigNumberList: [1,2,3]});
        let res = await table.findOne({name:'A'});
        expect(res.bigNumberList).toEqual([1,2,3]);

        await table.insert({name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER+10]}, false);
        //try {
        //    res = await table.findOne({name: 'B'});
        //    expect(false).toBeTruthy();
        //} catch (e) {
        //    expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        //}
    }));

    it("timestamptz[]",  w(async() => {
        await table.insert({
            name: 'A',
            timestamptzList: [new Date('2000-01-01 00:00:00').toISOString(), new Date('2001-01-01 00:00:00').toISOString()]
        });
        let res = await table.findOne({name: 'A'});
        expect(res.timestamptzList[0]).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.timestamptzList[1]).toEqual(new Date('2001-01-01 00:00:00'));
        expect(res.timestamptzList.length).toEqual(2);
    }));

    it("timestamp and timestamptz",  w(async() => {
        await table.insert({name: 'A',
            created:new Date('2000-01-01 00:00:00'),
            createdtz:new Date('2000-01-01 00:00:00')
        });
        let res = await table.findOne({name:'A'});

        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.count({'created':new Date('2000-01-01 00:00:00')});
        expect(res).toEqual(1);

        res = await table.count({'createdtz':new Date('2000-01-01 00:00:00')});
        expect(res).toEqual(1);

        let d = new Date('2000-01-01 00:00:00').toISOString();
        await table.query(`INSERT INTO ${table} (name, created, createdtz) values ('A2', '${d}'::timestamptz, '${d}'::timestamptz)`);
        res = await table.findOne({name:'A2'});

        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND created='${d}'::timestamptz`);
        expect(res.length).toEqual(1);

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND createdtz='${d}'::timestamptz`);
        expect(res.length).toEqual(1);
    }));

    it("transaction - rollback",  w(async() => {
        await table.insert({name: 'A'});
        let res;

        let pgdbwt = await pgdb.transactionBegin();
        await pgdbwt.schemas[schema]['users'].insert({name: 'B'});

        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');

        await pgdbwt.transactionRollback();

        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');
    }));

    it("transaction - commit",  w(async() => {
        await table.insert({name: 'A'});
        let res;

        let pgdbwt = await pgdb.transactionBegin();
        await pgdbwt.schemas[schema]['users'].insert({name: 'B'});

        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');

        await pgdbwt.transactionCommit();

        res = await table.findAll();
        expect(res.length).toEqual(2);
        expect(res[0].name).toEqual('A');
        expect(res[1].name).toEqual('B');
    }));


    it("stream - auto connection handling",  w(async() => {
        var size = await table.count();
        let stream = await table.queryAsStream(`select * from ${table}`);
        let streamSize = 0;
        stream.on('data',()=>{streamSize++});
        expect(size).toEqual(streamSize);
    }));
});
