import { PgDb } from "./pgDb";
import { PgTable } from "./pgTable";
import * as _ from 'lodash';

/**
 * {,ads,"asdf""fd,",",3,"   "}
 *
 s = ',ads,"asdf""fd,",",3,"   "';
 e =
 e.exec(s)
 */
function parseComplexTypeArray(str: string) {
    let list = JSON.parse('[' + str.substring(1, str.length - 1) + ']');

    let result = [];
    for (let elementStr of list) {
        result.push(parseComplexType(elementStr));
    }
    return result;
}

function parseComplexType(str: string): any[] {
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
        if (!parsingResult) break;
        valStr = (parsingResult[0] == '' || parsingResult[0] == ',' || parsingResult[2] == 'null') ? null : parsingResult[1] || parsingResult[2];
        if (parsingResult[0] == '"",' || parsingResult[0] == '""') {
            valStr = '';
        }
        valList.push(valStr ? valStr.replace(/""/g, '"') : valStr);
        hasNextValue = parsingResult[0].substring(parsingResult[0].length - 1, parsingResult[0].length) == ',';
    } while (hasNextValue);
    return valList;
}

//jasmine.DEFAULT_TIMEOUT_INTERVAL = 800000;

describe("pgdb", () => {
    let pgdb: PgDb;
    let schema = 'pgdb_test';
    let hiddenSchema = 'pgdb_test_hidden';
    let table: PgTable<any>;
    let tableGroups: PgTable<any>;
    let tableTypes: PgTable<any>;

    beforeAll(async () => {
        /**
         * Using environment variables, e.g.
         * PGUSER (defaults USER env var, so optional)
         * PGDATABASE (defaults USER env var, so optional)
         * PGPASSWORD
         * PGPORT
         * etc...
         */
        try {
            pgdb = await PgDb.connect({ connectionString: "postgres://" });
        } catch (e) {
            console.error("connection failed! Are you specified PGUSER/PGDATABASE/PGPASSWORD correctly?");
            process.exit(1);
        }

        //create schema without access rights
        let current_role = await pgdb.queryOneField('SELECT current_role');

        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + hiddenSchema + '"');
        await pgdb.run('GRANT ALL ON SCHEMA "' + hiddenSchema + '" TO "' + current_role + '"');
        await pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + hiddenSchema + '"'));
        await pgdb.run('REVOKE ALL ON SCHEMA "' + hiddenSchema + '" FROM "' + current_role + '" CASCADE');

        //await pgdb.run('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE ');
        await pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        await pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        await pgdb.reload();

        pgdb.setLogger(console);
        table = pgdb.schemas[schema]['users'];
        tableGroups = pgdb.schemas[schema]['groups'];
        tableTypes = pgdb.schemas[schema]['types'];
    });

    beforeEach(async () => {
        await table.delete({});
        await tableGroups.delete({});
        await tableTypes.delete({});
    });

    afterEach(async () => {
        if (pgdb.pool.waitingCount != 0) {
            expect('Not all connection is released').toBeFalsy();
            await pgdb.pool.end();
        }
    });

    afterAll(async () => {
        await pgdb.close();
    });

    it("Exception on name collision", async () => {
        await table.insert({ name: 'A' });
        try {
            await pgdb.query(`select u1.id, u2.id from ${table} u1 left join ${table} u2 ON true `);
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Name collision for the query, two or more fields have the same name./.test((<Error>e).message)).toBeTruthy();
        }
    });


    it("After adding parser should be able to parse complex type", async () => {
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
        let pf = await table.findOne({ name: 'Piszkos Fred' });
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
        expect(pf.permissionList[1]).toEqual(['write', 'book']);
        expect(pf.permissionList[2]).toEqual(['write', null]);
        expect(pf.permissionList[3]).toEqual([null, ""]);
        expect(pf.permissionList[4]).toEqual([null, null]);
        expect(pf.permissionList[5]).toEqual(['write', null]);
        expect(pf.permissionList.length).toEqual(6);
    });

    it("Complex type could be easily read and converted to json", async () => {
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
        expect(res[0].perjson).toEqual({ permission: 'read', resource: 'book' });
        expect(res[0].perlistjson).toEqual([
            { permission: 'admin', resource: 'chaos j ()",""j ,' },
            { permission: 'write', resource: 'book' },
            { permission: 'write', resource: null },
            { permission: null, resource: '' },
            { permission: null, resource: null },
            { permission: 'write', resource: 'null' }
        ]);
    });

    it("List for a non array column in the condition should be converted to 'IN Array'", async () => {
        await table.insert({ name: 'Fulig Jimmy', favourites: ['sport'] });
        await table.insert({ name: 'Vanek ur', favourites: ['sport', 'food'] });
        await table.insert({ name: 'Gorcsev Ivan', favourites: ['tech', 'food'] });

        let res1 = await table.findAll();
        let res2 = await table.find({ id: res1.map(e => e.id) });
        expect(res1.map(c => c.id)).toEqual(res2.map(c => c.id));
    });

    it("Testing where function", async () => {
        await table.insert({ name: 'Fulig Jimmy', favourites: ['sport'] });
        await table.insert({ name: 'Vanek ur', favourites: ['sport', 'food'] });
        await table.insert({ name: 'Gorcsev Ivan', favourites: ['tech', 'food', 'sport'] });

        let res = await table.findWhere(':fav = ANY("favourites")', { fav: 'sport' });
        expect(res.length).toEqual(3);
        res = await table.findWhere(':fav = ANY("favourites")', { fav: 'food' });
        expect(res.length).toEqual(2);
        res = await table.findWhere(':fav = ANY("favourites")', { fav: 'tech' });
        expect(res.length).toEqual(1);
    });

    it("Upsert - with column names", async () => {
        await table.upsert({ name: 'Fulig Jimmy', textList: ['hiking'] }, { columns: ['name'] });
        let res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);

        await table.upsert({ name: 'Fulig Jimmy', textList: ['biking'] }, { columns: ['name'] });
        res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);

        res = await table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    });

    it("Upsert - with primary key", async () => {
        await table.upsert({ id: 1, name: 'Fulig Jimmy', textList: ['hiking'] });
        let res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);

        await table.upsert({ id: 1, name: 'Fulig Jimmy', textList: ['biking'] });
        res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);

        res = await table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    });

    it("Upsert - with constraint name", async () => {
        await table.upsert({ name: 'Fulig Jimmy', textList: ['hiking'] }, { constraint: "users_name_key" });
        let res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);

        await table.upsert({ name: 'Fulig Jimmy', textList: ['biking'] }, { constraint: "users_name_key" });
        res = await table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);

        res = await table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    });

    it("UpsertAndGet - with constraint name", async () => {
        let res = await table.upsertAndGet({ name: 'Fulig Jimmy', textList: ['hiking'] }, { constraint: "users_name_key" });
        expect(res.textList).toEqual(['hiking']);

        res = await table.upsertAndGet({ name: 'Fulig Jimmy', textList: ['biking'] }, { constraint: "users_name_key" });
        expect(res.textList).toEqual(['biking']);
    });

    it("Ignore field with undefined value if requested, but keep with null value", async () => {
        await table.insert({ name: 'A', numberList: [1, 2] });

        let res = await table.find({ name: undefined }, { skipUndefined: true });
        expect(res.length).toEqual(1);

        res = await table.find({ name: null }, { skipUndefined: true });
        expect(res.length).toEqual(0);

        let res2 = await table.updateAndGetOne({ name: 'A' }, {
            numberList: undefined,
            favourites: ['sport']
        }, { skipUndefined: true });
        expect(res2.numberList).toEqual([1, 2]);

        res2 = await table.updateAndGetOne({
            name: 'A',
            numberList: undefined
        }, { numberList: null }, { skipUndefined: true });
        expect(res2.numberList).toEqual(null);
    });

    it("Test return only column values ", async () => {
        await table.insert({ name: 'A', membership: 'gold' });
        await table.insert({ name: 'B', membership: 'gold' });
        await table.insert({ name: 'C', membership: 'bronze' });

        let res1 = await table.queryOneColumn("SELECT name || '_' || membership FROM " + table + " WHERE LENGTH(name)=1");
        expect(res1).toEqual(['A_gold', 'B_gold', 'C_bronze']);
    });

    it("Test count ", async () => {
        await table.insert({ name: 'A', membership: 'gold' });
        await table.insert({ name: 'B', membership: 'gold' });
        await table.insert({ name: 'C', membership: 'bronze' });

        let res1 = await table.count({ membership: 'gold' });
        expect(res1).toEqual(2);
    });

    it("Test AND - OR ", async () => {
        await table.insert({ name: 'A', membership: 'gold', favourites: ['sport'] });
        await table.insert([
            { name: 'BC', membership: 'gold', favourites: ['sport'] },
            { name: 'D', membership: 'bronze', favourites: ['tech'] },
            { name: 'E', membership: 'bronze', favourites: ['tech', 'food'] }
        ]);

        let res;
        res = await table.find({ 'membership': "bronze", or: [{ 'name': 'BC' }, { favourites: 'food', name: 'E' }] });
        expect(res.length).toEqual(1);

        res = await table.find({ name: 'A' });
        res = await table.count({
            and: [
                { or: [{ name: ['A', 'BC'] }, { 'updated >': res[0].updated }] },
                { or: [{ membership: 'bronze' }, { 'favourites @>': ['food'] }] }
            ]
        });
        expect(res).toEqual(2);
    });

    it("Test insert with switched fields", async () => {
        await table.insert([{ name: 'A', membership: 'gold' }, { membership: 'gold', name: 'B' }]);

        let res = await pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    });

    it("Test named parameters ", async () => {
        await table.insert({ name: 'A', membership: 'gold' });
        await table.insert({ name: 'B', membership: 'gold' });
        await table.insert({ name: 'C', membership: 'bronze' });

        let res = await pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    });

    it("text[]", async () => {
        await table.insert({ name: 'A', textList: ['good', 'better', 'best'] });
        let res = await table.findOne({ name: 'A' });
        expect(res.textList).toEqual(['good', 'better', 'best']);
    });

    it("integer[]", async () => {
        await table.insert({ name: 'A', numberList: [1, 2, 3] });
        let res = await table.findOne({ name: 'A' });
        expect(res.numberList).toEqual([1, 2, 3]);
    });

    it("integer[]", async () => {
        await table.insert({ name: 'A', numberList: [null, 1, 2, 3] });
        let res = await table.findOne({ name: 'A' });
        expect(res.numberList).toEqual([null, 1, 2, 3]);
    });

    it("bigInt[]", async () => {
        await table.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        let res = await table.findOne({ name: 'A' });
        expect(res.bigNumberList).toEqual([1, 2, 3]);

        await table.insert({ name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10] });
        try {
            await table.findOne({ name: 'B' });
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test((<Error>e).message)).toBeTruthy();
        }
    });

    it("bigInt[] cursor callback", async () => {
        await table.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        let res!: number[];
        await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (rec) => {
            res = rec.bigNumberList;
        });
        expect(res).toEqual([1, 2, 3]);

        await table.insert({ name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10] });
        try {
            await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, () => {
            });
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test((<Error>e).message)).toBeTruthy();
        }
    });

    it("timestamptz[]", async () => {
        await table.insert({
            name: 'A',
            timestamptzList: [new Date('2000-01-01 00:00:00').toISOString(), new Date('2001-01-01 00:00:00').toISOString()]
        });
        let res = await table.findOne({ name: 'A' });
        expect(res.timestamptzList[0]).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.timestamptzList[1]).toEqual(new Date('2001-01-01 00:00:00'));
        expect(res.timestamptzList.length).toEqual(2);
    });

    it("timestamp and timestamptz", async () => {
        await table.insert({
            name: 'A',
            created: new Date('2000-01-01 00:00:00'),
            createdtz: new Date('2000-01-01 00:00:00')
        });
        let res = await table.findOne({ name: 'A' });

        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.count({ 'created': new Date('2000-01-01 00:00:00') });
        expect(res).toEqual(1);

        res = await table.count({ 'createdtz': new Date('2000-01-01 00:00:00') });
        expect(res).toEqual(1);

        let d = new Date('2000-01-01 00:00:00').toISOString();
        await table.query(`INSERT INTO ${table} (name, created, createdtz) values ('A2', '${d}'::timestamptz, '${d}'::timestamptz)`);
        res = await table.findOne({ name: 'A2' });

        // this expectation is depend on machine timezone
        // expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND created='${d}'::timestamptz`);
        expect(res.length).toEqual(1);

        res = await table.query(`SELECT * FROM ${table} WHERE name='A2' AND createdtz='${d}'::timestamptz`);
        expect(res.length).toEqual(1);
    });

    it("transaction - rollback", async () => {
        await table.insert({ name: 'A' });
        let res;

        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt.schemas[schema]['users'];
        await tablewt.insert({ name: 'B' });

        res = await table.count();
        expect(res).toEqual(1);

        res = await tablewt.count();
        expect(res).toEqual(2);

        await pgdbwt.transactionRollback();

        res = await table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');
    });

    it("transaction - savepoint - rollback", async () => {
        let tr = await pgdb.transactionBegin();
        let table = tr.schemas[schema]['users'];
        await table.insert({ name: 'a' });

        let res = await table.count();
        expect(res).toEqual(1);

        tr.savePoint('name');
        await table.insert({ name: 'b' });
        res = await table.count();
        expect(res).toEqual(2);

        await tr.transactionRollback({ savePoint: 'name' });

        res = await table.count();
        expect(res).toEqual(1);
        await tr.transactionRollback();
        res = await table.count();
        expect(res).toEqual(0);

    });

    it("transaction should keep the table definitions", async () => {
        const pgDB = pgdb; //= await PgDb.connect({connectionString: "postgres://"});
        const pgDBTrans = await pgDB.transactionBegin();

        let list1 = Object.keys(pgDB.tables);
        let list2 = Object.keys(pgDBTrans.tables);

        await pgDBTrans.transactionCommit();

        expect(list1.length).toEqual(list2.length);
        expect(list1.length > 0).toBeTruthy();

    });


    it("transaction - commit", async () => {
        await table.insert({ name: 'A' });

        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt.schemas[schema]['users'];
        await tablewt.insert({ name: 'B' });

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
    });

    it("transaction - error + rollback", async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        await tablewt.insert({ name: 'A' });

        try {
            await tablewt.insertAndGet({ name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100] });
            expect(false).toBeTruthy();
        } catch (e) {
            expect(/Number can't be represented in javascript/.test((<Error>e).message)).toBeTruthy();
            await pgdbwt.transactionRollback();
        }
        let res = await table.count();
        expect(res).toEqual(0);

    });

    it("cursor with callback", async () => {
        await table.insert({ name: 'A', numberList: [1, 2, 3] });
        await table.insert({ name: 'B' });
        let size = await table.count();
        let streamSize = 0;
        await table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (r) => {
            streamSize++;
            return true;
        });
        expect(streamSize).toBe(1);
    });

    it("stream - auto connection handling - normal", async () => {
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
    });

    it("stream - auto connection handling - early close", async () => {
        let counter = 0;
        let stream = await table.queryAsStream(`SELECT * FROM generate_series(0,1002) num`);
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c: any) => {
                if (counter == 10) {
                    stream.emit('close', 'e');
                    return resolve(undefined);
                }
                counter++;
            });

        });
        expect(counter).toEqual(10);
    });

    it("stream - auto connection handling - error", async () => {
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
    });

    it("stream - with transactions handling - normal", async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        await tablewt.insert({ name: 'A', numberList: [1, 2, 3] });
        await tablewt.insert({ name: 'B' });

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
    });

    it("stream - with transactions handling - early close", async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt[schema]['users'];
        await tablewt.insert({ name: 'A', numberList: [1, 2, 3] });
        await tablewt.insert({ name: 'B' });
        await tablewt.insert({ name: 'C' });
        await tablewt.insert({ name: 'D' });

        let counter = 0;
        let stream = await tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c: any) => {
                if (counter == 2) {
                    stream.emit('close', 'e');
                    return resolve(undefined);
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
    });

    it("stream - with transactions handling - error", async () => {
        let pgdbwt = await pgdb.transactionBegin();
        let tablewt = <PgTable<any>>pgdbwt[schema]['users'];
        await tablewt.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        await tablewt.insert({ name: 'B' });
        await tablewt.insert({ name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100] });
        await tablewt.insert({ name: 'D' });

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
            expect(/Number can't be represented in javascript/.test((<Error>e).message)).toBeTruthy();
        }
        expect(counter).toEqual(2);

        counter = await tablewt.count();
        expect(counter).toEqual(4);
        await pgdbwt.transactionRollback();

        counter = await table.count();
        expect(counter).toEqual(0);
    });

    it("truncate", async () => {
        await table.insert({ name: 'A' });
        await table.insert({ name: 'B' });

        await table.truncate();
        let size = await table.count();
        expect(size).toEqual(0);
    });

    it("truncate + special types", async () => {
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
        let pf = await table.findOne({ name: 'Piszkos Fred' });
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
    });

    it("truncate - cascade", async () => {
        let g = await tableGroups.insertAndGet({ name: 'G' });
        await table.insert({ name: 'A', mainGroup: g.id });
        await table.insert({ name: 'B', mainGroup: g.id });
        await tableGroups.truncate({ cascade: true, restartIdentity: true });

        let size = await table.count();
        expect(size).toEqual(0);

        let g2 = await tableGroups.insertAndGet({ name: 'G' }, { return: ['id'] });
        expect(g.id >= g2.id).toBeTruthy()
    });

    it("orderBy", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'B' });
        await table.insert({ name: 'C', aCategory: 'C' });
        await table.insert({ name: 'A2', aCategory: 'A' });
        await table.insert({ name: 'B2', aCategory: 'B' });
        await table.insert({ name: 'C2', aCategory: 'C' });

        let res;
        res = await table.find({}, { orderBy: ['aCategory', 'name'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);

        res = await table.find({}, { orderBy: { 'aCategory': 'asc', 'name': 'asc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);

        res = await table.find({}, { orderBy: ['aCategory asc', 'name desc'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, { orderBy: { 'aCategory': 'asc', 'name': 'desc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, { orderBy: ['+aCategory', '-name'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, { orderBy: '"aCategory" asc, name desc', fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);

        res = await table.find({}, { orderBy: { '"aCategory"': 'asc', 'name': 'desc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
    });

    it("stored proc", async () => {
        await table.insert({ name: 'A', membership: 'gold' });
        await table.insert({ name: 'B', membership: 'gold' });
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
    });

    it("executing sql file - if there is an exception, should be thrown", async () => {
        try {
            await pgdb.execute('src/test/throw_exception.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual("error: division_by_zero");
        }
    });

    it("select/update/delete should throw exception if the condition contains undefined value", async () => {
        await table.insert({ name: 'A', membership: 'gold' });
        let conditions = { name: 'A', membership: undefined };

        try {
            await table.find(conditions);
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        let res = await table.find(conditions, { skipUndefined: true });
        expect(res.length == 1).toBeTruthy();

        try {
            await table.update(conditions, { name: 'B' });
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        await table.update(conditions, { name: 'B' }, { skipUndefined: true });
        res = await table.find(conditions, { skipUndefined: true });
        expect(res.length == 0).toBeTruthy();

        try {
            conditions.name = 'B';
            await table.delete(conditions);
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        await table.delete(conditions, { skipUndefined: true });
        res = await table.findAll();
        expect(res.length == 0).toBeTruthy();

    });

    it("Testing deleteAndGet ", async () => {
        await table.insert({ name: 'A' });
        let res = await table.deleteAndGetOne({ name: 'A' });
        expect(res != null).toBeTruthy();
        expect(res.name == 'A').toBeTruthy();

        let res2 = await table.deleteAndGetOne({ name: 'A' });
        expect(res2 == null).toBeTruthy();
    });

    it("Testing postprocess function", async () => {
        await table.insert({ name: 'A' });

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
    });

    it("Testing deleteAndGet", async () => {
        await table.insert([{ name: 'A' }, { name: 'B' }]);
        let res = await table.deleteAndGet({ name: ['A', 'B'] });
        expect(res.length == 2).toBeTruthy();
    });

    it("Testing sql execution", async () => {
        await pgdb.execute('src/test/tricky.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
    });

    it("Testing text array parsing", async () => {
        let list = ["'A'", '"A"', 'normal', '//', '\\', '\\\\\\"', '\\\\"', '\\"', '""', "''", '--', '/*', '', '<!--', JSON.stringify({
            a: 1,
            b: "aprocska\"kalapocska'bennecsacskamacskamocska"
        })];
        await table.insert({ name: 'A', textList: list });
        let rec: any = await table.findOne({ name: 'A' });
        console.log(list + '\n' + rec.textList);
        let isDifferent = list.some((v, i) => rec.textList[i] !== v);
        expect(isDifferent).toBeFalsy();
    });

    it("Testing jsonb array parsing", async () => {
        let list = [{
            "id": "fl1ace84f744",
            "name": "Wire 2017-09-17 at 11.57.55.png",
            "type": "image/png",
            "path": "/data/files/fl1ace84f744/Wire 2017-09-17 at 11.57.55.png",
            "title": "Wire 2017-09-17 at 11.57.55"
        }];
        await table.insert({ name: 'A', jsonbList: list });
        let rec: any = await table.findOne({ name: 'A' });
        console.log('xxx', rec.jsonbList, typeof rec.jsonbList[0]);
        console.log(JSON.stringify(list) + '\n' + JSON.stringify(rec.jsonbList));
        let isDifferent = list.some((v, i) => !_.isEqual(rec.jsonbList[i], v));
        expect(isDifferent).toBeFalsy();
    });

    it("Testing distinct", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'A' });
        let recs = await table.find({ aCategory: 'A' }, { fields: ['aCategory'], distinct: true });
        expect(recs.length).toEqual(1);
    });

    it("Testing queryOne", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'A' });
        try {
            let recs = await table.queryOne(`SELECT * FROM ${table} WHERE "aCategory" = 'A'`);
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual("Error: More then one rows exists");
        }
    });
    it("Testing queryFirst", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'A' });
        let rec = await table.queryFirst(`SELECT * FROM ${table} WHERE "aCategory" = 'A'`);
        expect(rec.aCategory).toEqual('A');
    });

    it("Testing forUpdate", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        let pgdb1 = await table.db.transactionBegin();
        await pgdb1.tables['users'].find({ aCategory: 'A' }, { forUpdate: true });
        let p = table.update({ aCategory: 'A' }, { name: 'C' });
        await new Promise(resolve => setTimeout(resolve, 500));
        await pgdb1.tables['users'].update({ aCategory: 'A' }, { name: 'B' });
        await pgdb1.transactionCommit();
        await p;
        let rec = await table.findFirst({ aCategory: 'A' });
        expect(rec.name).toEqual('C');
    });

    it("Testing update where something is null", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.update({ textList: null }, { name: 'B' });
        let rec = await table.findFirst({ aCategory: 'A' });
        expect(rec.name).toEqual('B');
    });

    it("Testing query with array equals", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'A' });
        await table.insert({ name: 'C', aCategory: 'A' });
        let recs = await table.find({ name: ['A', 'B'] });
        expect(recs.length).toEqual(2);
    });

    it("Testing query with array not equals", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        await table.insert({ name: 'B', aCategory: 'A' });
        await table.insert({ name: 'C', aCategory: 'A' });
        let recs = await table.find({ '"name" !=': ['A', 'B'] });
        expect(recs.length).toEqual(1);
    });

    it("Testing empty result with one field", async () => {
        let recs = await table.queryOneColumn(`select name from ${table}`);
        expect(recs.length).toEqual(0);
    });

    it("Testing empty result with one column", async () => {
        let rec = await table.queryOneField(`select name from ${table}`);
        expect(rec).toEqual(null);
    });

    it("Testing NOTIFY and LISTEN (listen)", async () => {
        let called: string | null | undefined = null;
        let payload = 'hello';

        await table.db.listen('test_channel', (notification) => called = notification.payload);
        await table.db.notify('test_channel', payload);

        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(called!).toEqual(payload);
    });

    it("Testing NOTIFY and LISTEN (unlisten)", async () => {
        let called = null;
        let payload = 'hello';

        await table.db.listen('test_channel', (notification) => called = notification.payload);
        await table.db.unlisten('test_channel');
        await table.db.notify('test_channel', payload);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(called).toEqual(null);
    });

    it("Testing Empty 'or' condition", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        let recs = await table.find({ or: [] });
        expect(recs.length).toEqual(1);
    });

    it("Testing Empty 'and' condition", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        let recs = await table.find({ and: [] });
        expect(recs.length).toEqual(1);
    });

    it("Testing row mode", async () => {
        await table.insert({ name: 'A', aCategory: 'A' });
        let result = await table.queryAsRows(`select * from ${table}`);
        expect(result.rows.length).toEqual(1);
        expect(result.columns.includes('id'));
        expect(result.columns.includes('name'));
        expect(result.columns.includes('aCategory'));
    });

    it("Testing output formats of default types", async () => {
        await tableTypes.insert({
            text: 'apple',
            int: 23,
            bigInt: 233,
            real: 0.5,
            double: 0.25,
            bool: false,
            json: { bool: true, number: 12, date: new Date(5), text: 'A' },
            jsonB: { bool: true, number: 12, date: new Date(5), text: 'A' },
            timestamptz: new Date(7),

            arrayText: ['apple', 'pear'],
            arrayInt: [1, 2],
            arrayBigInt: [100, 101, 102],
            arrayReal: [0.5, 1.5, 2.5],
            arrayDouble: [0.25, 1.25, 2.25],
            arrayBool: [true, false, true],
            arrayJson: [
                { bool: true, number: 12, text: 'A' },
                { bool: true, number: 12, text: 'A' }
            ],
            arrayJsonB: [
                { bool: true, number: 12, text: 'A' },
                { bool: true, number: 12, text: 'A' }
            ],
            arrayTimestamptz: [new Date(1), new Date(2)]
        });

        let result = await tableTypes.findFirst({});
        expect(result.text).toEqual('apple');
        expect(result.int).toEqual(23);
        expect(result.bigInt).toEqual(233);
        expect(result.real).toEqual(0.5);
        expect(result.double).toEqual(0.25);
        expect(result.bool).toEqual(false);

        expect(result.json.bool).toEqual(true);
        expect(result.json.number).toEqual(12);
        expect(typeof result.json.date).toEqual('string'); //This is not a feature, only actual situation, that dates are not stored in Date format in json objects
        expect(result.json.text).toEqual('A');

        expect(result.jsonB.bool).toEqual(true);
        expect(result.jsonB.number).toEqual(12);
        expect(typeof result.jsonB.date).toEqual('string');
        expect(result.jsonB.text).toEqual('A');

        expect(result.timestamptz).toEqual(new Date(7));

        expect(result.arrayText).toEqual(['apple', 'pear']);
        expect(result.arrayInt).toEqual([1, 2]);
        expect(result.arrayBigInt).toEqual([100, 101, 102]);
        expect(result.arrayReal).toEqual([0.5, 1.5, 2.5]);
        expect(result.arrayDouble).toEqual([0.25, 1.25, 2.25]);
        expect(result.arrayBool).toEqual([true, false, true]);
        expect(result.arrayJson).toEqual([
            { bool: true, number: 12, text: 'A' },
            { bool: true, number: 12, text: 'A' }
        ]);
        expect(result.arrayJsonB).toEqual([
            { bool: true, number: 12, text: 'A' },
            { bool: true, number: 12, text: 'A' }
        ]);
        expect(result.arrayTimestamptz).toEqual([new Date(1), new Date(2)]);
    });

    it("Testing output formats of enum types - query", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        await table.insert({ m: 'sad' });
        let result = await table.findFirst({});
        expect(result.m).toEqual('sad');

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        result = await table.findFirst({});
        expect(result.m).toEqual('sad');

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum types - queryWithOnCursorCallback without stop", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        await table.insert([{ m: 'sad' }, { m: 'sad' }]);
        let counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
        });
        expect(counter).toEqual(2);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
        });
        expect(counter).toEqual(2);

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum types - queryWithOnCursorCallback with stop", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        await table.insert([{ m: 'sad' }, { m: 'sad' }]);
        let counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum types - queryAsStream", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        await table.insert({ m: 'sad' });
        let stream = await table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual('sad');
        });
        await new Promise<any>((resolve, reject) => {
            stream.on('error', reject);
            stream.on('close', resolve);
        });
        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        stream = await table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual('sad');
        });
        try {
            await new Promise<any>((resolve, reject) => {
                stream.on('error', reject);
                stream.on('close', resolve);
            });
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: [337] Query returns fields with unknown oid.'); //This is not a feature, but a side-effect
        }
        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum array types - query", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        await table.insert({ m: ['sad', 'ok'] });
        let result = await table.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        result = await table.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum array types - queryWithOnCursorCallback without stop", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        await table.insert([{ m: ['sad', 'ok'] }, { m: ['sad', 'ok'] }]);
        let counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
        });
        expect(counter).toEqual(2);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
        });
        expect(counter).toEqual(2);

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum array types - queryWithOnCursorCallback with stop", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        await table.insert([{ m: ['sad', 'ok'] }, { m: ['sad', 'ok'] }]);
        let counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        counter = 0;
        await table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);

        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum array types - queryAsStream", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        await table.insert({ m: ['sad', 'ok'] });
        let stream = await table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
        });
        await new Promise<any>((resolve, reject) => {
            stream.on('error', reject);
            stream.on('close', resolve);
        });
        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        stream = await table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
        });
        try {
            await new Promise<any>((resolve, reject) => {
                stream.on('error', reject);
                stream.on('close', resolve);
            });
            expect(false).toBeTruthy();
        } catch (e) {
            expect('' + e).toEqual('Error: [337] Query returns fields with unknown oid.');
        }
        await pgdbwt.transactionRollback();
    });

    it("Testing output formats of enum array types - query on view", async () => {
        let pgdbwt = await pgdb.transactionBegin();

        await pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        await pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        await pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        await pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        await pgdbwt.run(`CREATE VIEW ${schema}."enumArrayTableView" as select m from ${schema}."enumArrayTable"`);
        await pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        await table.insert({ m: ['sad', 'ok'] });
        let view = pgdbwt.schemas[schema].tables["enumArrayTableView"];
        let result = await view.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);

        await pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            DROP VIEW ${schema}."enumArrayTableView";
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
            CREATE VIEW ${schema}."enumArrayTableView" as select m from ${schema}."enumArrayTable"
        `);
        result = await view.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);

        await pgdbwt.transactionRollback();
    });
});
