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


describe("pgdb", () => {
    let pgdb: PgDb;
    let schema = 'pgdb_test';
    let table: PgTable<any>;
    let tableGroups: PgTable<any>;

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
            process.exit(1);
        }
        //await pgdb.run('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE ');
        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        await pgdb.execute('spec/resources/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        await pgdb.reload();

        pgdb.setLogger(console);
        table = pgdb.schemas[schema]['users'];
        tableGroups = pgdb.schemas[schema]['groups'];
    }));

    beforeEach(w(async () => {
        await table.delete({});
        await tableGroups.delete({});
    }));

    afterEach(w(async () => {
        if (pgdb.pool._pendingQueue.length != 0) {
            expect('Not all connection is released').toBeFalsy();
            for (let connection of pgdb.pool._clients) {
                await connection.query('ROLLBACK');
                if (connection.release) {
                    console.log('stuck connection:', connection.processID);
                    connection.release();
                }
            }
        }
    }));

    it("Exception on name collision", w(async () => {
        await table.insert({name: 'A'});
        try {
            await pgdb.query(`select u1.id, u2.id from ${table} u1 left join ${table} u2 ON true `);
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Name collision for the query, two or more fields have the same name./.test(e.message)).toBeTruthy();
        }
    }));


    it("After adding parser should be able to parse complex type", w(async () => {
        await pgdb.setTypeParser('permissionForResourceType', (val) => parseComplexType(val));
        await pgdb.setTypeParser('_permissionForResourceType', (val) => val == "{}" ? [] : parseComplexTypeArray(val));
        await table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'],
        });
        let pf = await table.findOne({name: 'Piszkos Fred'});
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
        expect(pf.permissionList[1]).toEqual(['write', 'book']);
        expect(pf.permissionList[2]).toEqual(['write', null]);
        expect(pf.permissionList[3]).toEqual([null, ""]);
        expect(pf.permissionList[4]).toEqual([null, null]);
        expect(pf.permissionList[5]).toEqual(['write', null]);
        expect(pf.permissionList.length).toEqual(6);
    }));

    it("Complex type could be easily read and converted to json", w(async () => {
        await table.insert({
            name: 'Elveszett cirkalo',
            permission: "(read,book)",
            permissionList: [
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
        expect(res[0].perjson).toEqual({permission: 'read', resource: 'book'});
        expect(res[0].perlistjson).toEqual([
            {permission: 'admin', resource: 'chaos j ()",""j ,'},
            {permission: 'write', resource: 'book'},
            {permission: 'write', resource: null},
            {permission: null, resource: ''},
            {permission: null, resource: null},
            {permission: 'write', resource: 'null'}
        ]);
    }));

    it("List for a non array column in the condition should be converted to 'IN Array'", w(async () => {
        await table.insert({name: 'Fulig Jimmy', favourites: ['sport']});
        await table.insert({name: 'Vanek ur', favourites: ['sport', 'food']});
        await table.insert({name: 'Gorcsev Ivan', favourites: ['tech', 'food']});

        let res1 = await table.findAll();
        let res2 = await table.find({id: res1.map(e => e.id)});
        expect(res1.map(c => c.id)).toEqual(res2.map(c => c.id));
    }));

    it("Testing where function", w(async () => {
        await table.insert({name: 'Fulig Jimmy', favourites: ['sport']});
        await table.insert({name: 'Vanek ur', favourites: ['sport', 'food']});
        await table.insert({name: 'Gorcsev Ivan', favourites: ['tech', 'food', 'sport']});

        let res = await table.findWhere(':fav = ANY("favourites")', {fav: 'sport'});
        expect(res.length).toEqual(3);
        res = await table.findWhere(':fav = ANY("favourites")', {fav: 'food'});
        expect(res.length).toEqual(2);
        res = await table.findWhere(':fav = ANY("favourites")', {fav: 'tech'});
        expect(res.length).toEqual(1);
    }));

    it("Ignore field with undefined value if requested, but keep with null value", w(async () => {
        await table.insert({name: 'A', numberList: [1, 2]});

        let res = await table.find({name: undefined}, {skipUndefined: true});
        expect(res.length).toEqual(1);

        res = await table.find({name: null}, {skipUndefined: true});
        expect(res.length).toEqual(0);

        let res2 = await table.updateAndGetOne({name: 'A'}, {
            numberList: undefined,
            favourites: ['sport']
        }, {skipUndefined: true});
        expect(res2.numberList).toEqual([1, 2]);

        res2 = await table.updateAndGetOne({
            name: 'A',
            numberList: undefined
        }, {numberList: null}, {skipUndefined: true});
        expect(res2.numberList).toEqual(null);
    }));

    it("Test return only column values ", w(async () => {
        await table.insert({name: 'A', membership: 'gold'});
        await table.insert({name: 'B', membership: 'gold'});
        await table.insert({name: 'C', membership: 'bronze'});

        let res1 = await table.queryOneColumn("SELECT name || '_' || membership FROM " + table + " WHERE LENGTH(name)=1");
        expect(res1).toEqual(['A_gold', 'B_gold', 'C_bronze']);
    }));

    it("Test count ", w(async () => {
        await table.insert({name: 'A', membership: 'gold'});
        await table.insert({name: 'B', membership: 'gold'});
        await table.insert({name: 'C', membership: 'bronze'});

        let res1 = await table.count({membership: 'gold'});
        expect(res1).toEqual(2);
    }));

    it("Test AND - OR ", w(async () => {
        await table.insert({name: 'A', membership: 'gold', favourites: ['sport']});
        await table.insert([
            {name: 'BC', membership: 'gold', favourites: ['sport']},
            {name: 'D', membership: 'bronze', favourites: ['tech']},
            {name: 'E', membership: 'bronze', favourites: ['tech', 'food']}
        ]);

        let res;
        res = await table.find({'membership': "bronze", or: [{'name': 'BC'}, {favourites: 'food', name: 'E'}]});
        expect(res.length).toEqual(1);

        res = await table.find({name: 'A'});
        res = await table.count({
            and: [
                {or: [{name: ['A', 'BC']}, {'updated >': res[0].updated}]},
                {or: [{membership: 'bronze'}, {'favourites @>': ['food']}]}
            ]
        });
        expect(res).toEqual(2);
    }));

    it("Test insert with switched fields", w(async () => {
        await table.insert([{name: 'A', membership: 'gold'}, {membership: 'gold', name: 'B'}]);

        let res = await pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    }));

    it("Test named parameters ", w(async () => {
        await table.insert({name: 'A', membership: 'gold'});
        await table.insert({name: 'B', membership: 'gold'});
        await table.insert({name: 'C', membership: 'bronze'});

        let res = await pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    }));

    it("text[]", w(async () => {
        await table.insert({name: 'A', textList: ['good', 'better', 'best']});
        let res = await table.findOne({name: 'A'});
        expect(res.textList).toEqual(['good', 'better', 'best']);
    }));

    it("integer[]", w(async () => {
        await table.insert({name: 'A', numberList: [1, 2, 3]});
        let res = await table.findOne({name: 'A'});
        expect(res.numberList).toEqual([1, 2, 3]);
    }));

    it("bigInt[]", w(async () => {
        await table.insert({name: 'A', bigNumberList: [1, 2, 3]});
        let res = await table.findOne({name: 'A'});
        expect(res.bigNumberList).toEqual([1, 2, 3]);

        await table.insert({name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10]});
        try {
            await table.findOne({name: 'B'});
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
    }));

    it("bigInt[] cursor callback", w(async () => {
        await table.insert({name: 'A', bigNumberList: [1, 2, 3]});
        let res;
        await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (rec) => {
            res = rec.bigNumberList;
        });
        expect(res).toEqual([1, 2, 3]);

        await table.insert({name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10]});
        try {
            await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, () => {
            });
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
    }));

    it("timestamptz[]", w(async () => {
        await table.insert({
            name: 'A',
            timestamptzList: [new Date('2000-01-01 00:00:00').toISOString(), new Date('2001-01-01 00:00:00').toISOString()]
        });
        let res = await table.findOne({name: 'A'});
        expect(res.timestamptzList[0]).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.timestamptzList[1]).toEqual(new Date('2001-01-01 00:00:00'));
        expect(res.timestamptzList.length).toEqual(2);
    }));

    it("timestamp and timestamptz", w(async () => {
        await table.insert({
            name: 'A',
            created: new Date('2000-01-01 00:00:00'),
            createdtz: new Date('2000-01-01 00:00:00')
        });
        let res = await table.findOne({name: 'A'});

        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.count({'created': new Date('2000-01-01 00:00:00')});
        expect(res).toEqual(1);

        res = await table.count({'createdtz': new Date('2000-01-01 00:00:00')});
        expect(res).toEqual(1);

        let d = new Date('2000-01-01 00:00:00').toISOString();
        await table.query(`INSERT INTO ${table} (name, created, createdtz) values ('A2', '${d}'::timestamptz, '${d}'::timestamptz)`);
        res = await table.findOne({name: 'A2'});

        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND created='${d}'::timestamptz`);
        expect(res.length).toEqual(1);

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND createdtz='${d}'::timestamptz`);
        expect(res.length).toEqual(1);
    }));

    it("transaction - rollback", w(async () => {
        await table.insert({name: 'A'});
        let res;

        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt.schemas[schema]['users'];
        await tablewt.insert({name: 'B'});

        res = await table.count();
        expect(res).toEqual(1);

        res = await tablewt.count();
        expect(res).toEqual(2);

        await pgdbwt.transactionRollback();

        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');
    }));

    it("transaction should keep the table definitions", w(async () => {
        const pgDB = pgdb; //= await PgDb.connect({connectionString: "postgres://"});
        const dPgDb = await pgDB.transactionBegin();

        let list1 = Object.keys(pgDB.tables);
        let list2 = Object.keys(dPgDb.tables);

        await dPgDb.transactionCommit();

        expect(list1.length).toEqual(list2.length);
        expect(list1.length > 0).toBeTruthy();

    }));


    it("transaction - commit", w(async () => {
        await table.insert({name: 'A'});

        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt.schemas[schema]['users'];
        await tablewt.insert({name: 'B'});

        let res;
        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');

        res = await tablewt.count();
        expect(res).toEqual(2);

        await pgdbwt.transactionCommit();

        res = await table.findAll();
        expect(res.length).toEqual(2);
        expect(res[0].name).toEqual('A');
        expect(res[1].name).toEqual('B');
    }));

    it("transaction - error + rollback", w(async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        await tablewt.insert({name: 'A'});

        try {
            await tablewt.insertAndGet({name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100]});
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
            await pgdbwt.transactionRollback();
        }
        let res = await table.count();
        expect(res).toEqual(0);

    }));

    it("cursor with callback", w(async () => {
        await table.insert({name: 'A', numberList: [1, 2, 3]});
        await table.insert({name: 'B'});
        let size = await table.count();
        let streamSize = 0;
        await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (r) => {
            streamSize++;
            return true
        });
        expect(size).toEqual(streamSize);
    }));

    it("stream - auto connection handling - normal", w(async () => {
        let counter = 0;
        let stream = await table.queryAsStream(`SELECT * FROM generate_series(0, $1) num`, [1001]);
        stream.on('data', (c: any) => {
            if (c.num != counter) {
                expect(false).toBeTruthy();
            }
            counter++;
        });
        await new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(1001 + 1);
    }));

    it("stream - auto connection handling - early close", w(async () => {
        let counter = 0;
        let stream = await table.queryAsStream(`SELECT * FROM generate_series(0,1002) num`);
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c: any) => {
                if (counter == 10) {
                    stream.emit('close', 'e');
                    return resolve();
                }
                counter++;
            });

        });
        expect(counter).toEqual(10);
    }));

    it("stream - auto connection handling - error", w(async () => {
        let counter = 0;
        let stillSafe = Number.MAX_SAFE_INTEGER - 5;
        let wrongNum = Number.MAX_SAFE_INTEGER + 100;
        let stream = await table.queryAsStream(`SELECT * FROM generate_series(${stillSafe}, ${wrongNum}) num`);
        stream.on('data', (c: any) => {
            counter++;
        });
        await new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(6);
    }));

    it("stream - with transactions handling - normal", w(async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        await tablewt.insert({name: 'A', numberList: [1, 2, 3]});
        await tablewt.insert({name: 'B'});

        let counter = 0;
        let stream = await tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        stream.on('data', (c: any) => counter++);
        await new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(2);

        counter = await tablewt.count();
        expect(counter).toEqual(2);
        await pgdbwt.transactionRollback();

        counter = await table.count();
        expect(counter).toEqual(0);
    }));

    it("stream - with transactions handling - early close", w(async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt[schema]['users'];
        await tablewt.insert({name: 'A', numberList: [1, 2, 3]});
        await tablewt.insert({name: 'B'});
        await tablewt.insert({name: 'C'});
        await tablewt.insert({name: 'D'});

        let counter = 0;
        let stream = await tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c: any) => {
                if (counter == 2) {
                    stream.emit('close', 'e');
                    return resolve();
                }
                counter++;
            });
        });
        expect(counter).toEqual(2);

        counter = await tablewt.count();
        expect(counter).toEqual(4);
        await pgdbwt.transactionRollback();

        counter = await table.count();
        expect(counter).toEqual(0);
    }));

    it("stream - with transactions handling - error", w(async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt[schema]['users'];
        await tablewt.insert({name: 'A', bigNumberList: [1, 2, 3]});
        await tablewt.insert({name: 'B'});
        await tablewt.insert({name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100]});
        await tablewt.insert({name: 'D'});

        let counter = 0;
        let stream = await tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        try {
            stream.on('data', (c: any) => {
                counter++;
            });
            await new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
            });
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
        expect(counter).toEqual(2);

        counter = await tablewt.count();
        expect(counter).toEqual(4);
        await pgdbwt.transactionRollback();

        counter = await table.count();
        expect(counter).toEqual(0);
    }));

    it("truncate", w(async () => {
        await table.insert({name: 'A'});
        await table.insert({name: 'B'});

        await table.truncate();
        let size = await table.count();
        expect(size).toEqual(0);
    }));

    it("truncate + special types", w(async () => {
        await pgdb.setTypeParser('permissionForResourceType', (val) => parseComplexType(val));
        await pgdb.setTypeParser('_permissionForResourceType', (val) => val == "{}" ? [] : parseComplexTypeArray(val));
        await table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'],
        });

        await table.truncate();

        await table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'],
        });
        let pf = await table.findOne({name: 'Piszkos Fred'});
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
    }));

    it("truncate - cascade", w(async () => {
        let g = await tableGroups.insertAndGet({name: 'G'});
        await table.insert({name: 'A', mainGroup: g.id});
        await table.insert({name: 'B', mainGroup: g.id});
        await tableGroups.truncate({cascade: true, restartIdentity: true});

        let size = await table.count();
        expect(size).toEqual(0);

        let g2 = await tableGroups.insertAndGet({name: 'G'}, {return: ['id']});
        expect(g.id >= g2.id).toBeTruthy()
    }));

    it("orderBy", w(async () => {
        await table.insert({name: 'A', aCategory: 'A'});
        await table.insert({name: 'B', aCategory: 'B'});
        await table.insert({name: 'C', aCategory: 'C'});
        await table.insert({name: 'A2', aCategory: 'A'});
        await table.insert({name: 'B2', aCategory: 'B'});
        await table.insert({name: 'C2', aCategory: 'C'});

        let res;
        res = await table.find({}, {orderBy: ['aCategory', 'name'], fields: ['name']});
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);

        res = await table.find({}, {orderBy: ['aCategory asc', 'name desc'], fields: ['name']});
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, {orderBy: ['+aCategory', '-name'], fields: ['name']});
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, {orderBy: '"aCategory" asc, name desc', fields: ['name']});
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
    }));

    it("stored proc", w(async () => {
        await table.insert({name: 'A', membership: 'gold'});
        await table.insert({name: 'B', membership: 'gold'});
        expect(pgdb[schema].fn['list_gold_users']).toBeDefined();
        expect(pgdb.fn['increment']).toBeDefined();
        let s = await pgdb.run('select current_schema');
        console.log(s);
        let res = await pgdb[schema].fn['list_gold_users']();
        console.log(res);
        expect(res).toEqual(['A', 'B']);

        res = await pgdb.fn['increment'](3);
        console.log(res);
        expect(res).toEqual(4);
    }));

    it("executing sql file - if there is an exception, should be thrown", w(async () => {
        try {
            await pgdb.execute('spec/resources/throw_exception.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual("error: division_by_zero");
        }
    }));

    it("select/update/delete should throw exception if the condition contains undefined value", w(async () => {
        await table.insert({name: 'A', membership: 'gold'});
        let conditions = {name: 'A', membership: undefined};

        try {
            await table.find(conditions);
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        let res = await table.find(conditions, {skipUndefined: true});
        expect(res.length == 1).toBeTruthy();

        try {
            await table.update(conditions, {name: 'B'});
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        await table.update(conditions, {name: 'B'}, {skipUndefined: true});
        res = await table.find(conditions, {skipUndefined: true});
        expect(res.length == 0).toBeTruthy();

        try {
            conditions.name = 'B';
            await table.delete(conditions);
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        await table.delete(conditions, {skipUndefined: true});
        res = await table.findAll();
        expect(res.length == 0).toBeTruthy();

    }));

    it("Testing deleteAndGet ", w(async () => {
        await table.insert({name: 'A'});
        let res = await table.deleteAndGetOne({name: 'A'});
        expect(res != null).toBeTruthy();
        expect(res.name == 'A').toBeTruthy();

        let res2 = await table.deleteAndGetOne({name: 'A'});
        expect(res2 == null).toBeTruthy();
    }));

    it("Testing postprocess function", w(async () => {
        await table.insert({name: 'A'});

        pgdb.setPostProcessResult((res, fields, logger) => {
            res[0].name = 'B';
        });
        let res = await pgdb.query(`select * from ${table}`);
        expect(res[0].name == 'B').toBeTruthy();
        res = await table.findAll();
        expect(res[0].name == 'B').toBeTruthy();
        pgdb.setPostProcessResult(null);
        res = await table.findAll();
        expect(res[0].name == 'A').toBeTruthy();
    }));

    it("Testing deleteAndGet", w(async () => {
        await table.insert([{name: 'A'}, {name: 'B'}]);
        let res = await table.deleteAndGet({name: ['A', 'B']});
        expect(res.length == 2).toBeTruthy();
    }));

    it("Testing sql execution", w(async () => {
        await pgdb.execute('spec/resources/tricky.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
    }));

    it("Testing text array parsing", w(async () => {
        let list = ["'A'", '"A"', '//', '\\', '""', "''", '--', '/*', '<!--'];
        await table.insert({name: 'A', textList: list});
        let rec: any = await table.findOne({name: 'A'});
        console.log(list + '\n' + rec.textList);
        let isDifferent = list.some((v, i) => rec.textList[i] !== v);
        expect(isDifferent).toBeFalsy();
    }));

});
