"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pgDb_1 = require("./pgDb");
const _ = require("lodash");
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
describe("pgdb", () => {
    let pgdb;
    let schema = 'pgdb_test';
    let hiddenSchema = 'pgdb_test_hidden';
    let table;
    let tableGroups;
    let tableTypes;
    beforeAll(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        try {
            pgdb = yield pgDb_1.PgDb.connect({ connectionString: "postgres://" });
        }
        catch (e) {
            console.error("connection failed! Are you specified PGUSER/PGDATABASE/PGPASSWORD correctly?");
            process.exit(1);
        }
        let current_role = yield pgdb.queryOneField('SELECT current_role');
        yield pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + hiddenSchema + '"');
        yield pgdb.run('GRANT ALL ON SCHEMA "' + hiddenSchema + '" TO "' + current_role + '"');
        yield pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + hiddenSchema + '"'));
        yield pgdb.run('REVOKE ALL ON SCHEMA "' + hiddenSchema + '" FROM "' + current_role + '" CASCADE');
        yield pgdb.run('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
        yield pgdb.execute('src/test/init.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        yield pgdb.reload();
        pgdb.setLogger(console);
        table = pgdb.schemas[schema]['users'];
        tableGroups = pgdb.schemas[schema]['groups'];
        tableTypes = pgdb.schemas[schema]['types'];
    }));
    beforeEach(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.delete({});
        yield tableGroups.delete({});
        yield tableTypes.delete({});
    }));
    afterEach(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        if (pgdb.pool.waitingCount != 0) {
            expect('Not all connection is released').toBeFalsy();
            yield pgdb.pool.end();
        }
    }));
    afterAll(() => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield pgdb.close();
    }));
    it("Exception on name collision", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        try {
            yield pgdb.query(`select u1.id, u2.id from ${table} u1 left join ${table} u2 ON true `);
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect(/Name collision for the query, two or more fields have the same name./.test(e.message)).toBeTruthy();
        }
    }));
    it("After adding parser should be able to parse complex type", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield pgdb.setTypeParser('permissionForResourceType', (val) => parseComplexType(val));
        yield pgdb.setTypeParser('_permissionForResourceType', (val) => val == "{}" ? [] : parseComplexTypeArray(val));
        yield table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'
            ],
        });
        let pf = yield table.findOne({ name: 'Piszkos Fred' });
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
        expect(pf.permissionList[1]).toEqual(['write', 'book']);
        expect(pf.permissionList[2]).toEqual(['write', null]);
        expect(pf.permissionList[3]).toEqual([null, ""]);
        expect(pf.permissionList[4]).toEqual([null, null]);
        expect(pf.permissionList[5]).toEqual(['write', null]);
        expect(pf.permissionList.length).toEqual(6);
    }));
    it("Complex type could be easily read and converted to json", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({
            name: 'Elveszett cirkalo',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'
            ],
        });
        let res = yield table.query(`SELECT to_json(permission) perjson, to_json("permissionList") perlistjson
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
    }));
    it("List for a non array column in the condition should be converted to 'IN Array'", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'Fulig Jimmy', favourites: ['sport'] });
        yield table.insert({ name: 'Vanek ur', favourites: ['sport', 'food'] });
        yield table.insert({ name: 'Gorcsev Ivan', favourites: ['tech', 'food'] });
        let res1 = yield table.findAll();
        let res2 = yield table.find({ id: res1.map(e => e.id) });
        expect(res1.map(c => c.id)).toEqual(res2.map(c => c.id));
    }));
    it("Testing where function", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'Fulig Jimmy', favourites: ['sport'] });
        yield table.insert({ name: 'Vanek ur', favourites: ['sport', 'food'] });
        yield table.insert({ name: 'Gorcsev Ivan', favourites: ['tech', 'food', 'sport'] });
        let res = yield table.findWhere(':fav = ANY("favourites")', { fav: 'sport' });
        expect(res.length).toEqual(3);
        res = yield table.findWhere(':fav = ANY("favourites")', { fav: 'food' });
        expect(res.length).toEqual(2);
        res = yield table.findWhere(':fav = ANY("favourites")', { fav: 'tech' });
        expect(res.length).toEqual(1);
    }));
    it("Upsert - with column names", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.upsert({ name: 'Fulig Jimmy', textList: ['hiking'] }, { columns: ['name'] });
        let res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);
        yield table.upsert({ name: 'Fulig Jimmy', textList: ['biking'] }, { columns: ['name'] });
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    }));
    it("Upsert - with primary key", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.upsert({ id: 1, name: 'Fulig Jimmy', textList: ['hiking'] });
        let res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);
        yield table.upsert({ id: 1, name: 'Fulig Jimmy', textList: ['biking'] });
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    }));
    it("Upsert - with constraint name", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.upsert({ name: 'Fulig Jimmy', textList: ['hiking'] }, { constraint: "users_name_key" });
        let res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(1);
        yield table.upsert({ name: 'Fulig Jimmy', textList: ['biking'] }, { constraint: "users_name_key" });
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'hiking' });
        expect(res.length).toEqual(0);
        res = yield table.findWhere(':fav = ANY("textList")', { fav: 'biking' });
        expect(res.length).toEqual(1);
    }));
    it("UpsertAndGet - with constraint name", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let res = yield table.upsertAndGet({ name: 'Fulig Jimmy', textList: ['hiking'] }, { constraint: "users_name_key" });
        expect(res.textList).toEqual(['hiking']);
        res = yield table.upsertAndGet({ name: 'Fulig Jimmy', textList: ['biking'] }, { constraint: "users_name_key" });
        expect(res.textList).toEqual(['biking']);
    }));
    it("Ignore field with undefined value if requested, but keep with null value", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', numberList: [1, 2] });
        let res = yield table.find({ name: undefined }, { skipUndefined: true });
        expect(res.length).toEqual(1);
        res = yield table.find({ name: null }, { skipUndefined: true });
        expect(res.length).toEqual(0);
        let res2 = yield table.updateAndGetOne({ name: 'A' }, {
            numberList: undefined,
            favourites: ['sport']
        }, { skipUndefined: true });
        expect(res2.numberList).toEqual([1, 2]);
        res2 = yield table.updateAndGetOne({
            name: 'A',
            numberList: undefined
        }, { numberList: null }, { skipUndefined: true });
        expect(res2.numberList).toEqual(null);
    }));
    it("Test return only column values ", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold' });
        yield table.insert({ name: 'B', membership: 'gold' });
        yield table.insert({ name: 'C', membership: 'bronze' });
        let res1 = yield table.queryOneColumn("SELECT name || '_' || membership FROM " + table + " WHERE LENGTH(name)=1");
        expect(res1).toEqual(['A_gold', 'B_gold', 'C_bronze']);
    }));
    it("Test count ", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold' });
        yield table.insert({ name: 'B', membership: 'gold' });
        yield table.insert({ name: 'C', membership: 'bronze' });
        let res1 = yield table.count({ membership: 'gold' });
        expect(res1).toEqual(2);
    }));
    it("Test AND - OR ", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold', favourites: ['sport'] });
        yield table.insert([
            { name: 'BC', membership: 'gold', favourites: ['sport'] },
            { name: 'D', membership: 'bronze', favourites: ['tech'] },
            { name: 'E', membership: 'bronze', favourites: ['tech', 'food'] }
        ]);
        let res;
        res = yield table.find({ 'membership': "bronze", or: [{ 'name': 'BC' }, { favourites: 'food', name: 'E' }] });
        expect(res.length).toEqual(1);
        res = yield table.find({ name: 'A' });
        res = yield table.count({
            and: [
                { or: [{ name: ['A', 'BC'] }, { 'updated >': res[0].updated }] },
                { or: [{ membership: 'bronze' }, { 'favourites @>': ['food'] }] }
            ]
        });
        expect(res).toEqual(2);
    }));
    it("Test insert with switched fields", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert([{ name: 'A', membership: 'gold' }, { membership: 'gold', name: 'B' }]);
        let res = yield pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    }));
    it("Test named parameters ", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold' });
        yield table.insert({ name: 'B', membership: 'gold' });
        yield table.insert({ name: 'C', membership: 'bronze' });
        let res = yield pgdb.query("SELECT count(*) FROM :!schema.:!table WHERE membership = :membership", {
            schema: schema,
            table: 'users',
            membership: 'gold'
        });
        expect(res[0].count).toEqual(2);
    }));
    it("text[]", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', textList: ['good', 'better', 'best'] });
        let res = yield table.findOne({ name: 'A' });
        expect(res.textList).toEqual(['good', 'better', 'best']);
    }));
    it("integer[]", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', numberList: [1, 2, 3] });
        let res = yield table.findOne({ name: 'A' });
        expect(res.numberList).toEqual([1, 2, 3]);
    }));
    it("integer[]", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', numberList: [null, 1, 2, 3] });
        let res = yield table.findOne({ name: 'A' });
        expect(res.numberList).toEqual([null, 1, 2, 3]);
    }));
    it("bigInt[]", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        let res = yield table.findOne({ name: 'A' });
        expect(res.bigNumberList).toEqual([1, 2, 3]);
        yield table.insert({ name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10] });
        try {
            yield table.findOne({ name: 'B' });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
    }));
    it("bigInt[] cursor callback", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        let res;
        yield table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (rec) => {
            res = rec.bigNumberList;
        });
        expect(res).toEqual([1, 2, 3]);
        yield table.insert({ name: 'B', bigNumberList: [1, Number.MAX_SAFE_INTEGER + 10] });
        try {
            yield table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, () => {
            });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
    }));
    it("timestamptz[]", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({
            name: 'A',
            timestamptzList: [new Date('2000-01-01 00:00:00').toISOString(), new Date('2001-01-01 00:00:00').toISOString()]
        });
        let res = yield table.findOne({ name: 'A' });
        expect(res.timestamptzList[0]).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.timestamptzList[1]).toEqual(new Date('2001-01-01 00:00:00'));
        expect(res.timestamptzList.length).toEqual(2);
    }));
    it("timestamp and timestamptz", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({
            name: 'A',
            created: new Date('2000-01-01 00:00:00'),
            createdtz: new Date('2000-01-01 00:00:00')
        });
        let res = yield table.findOne({ name: 'A' });
        expect(res.created).toEqual(new Date('2000-01-01 00:00:00'));
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));
        res = yield table.count({ 'created': new Date('2000-01-01 00:00:00') });
        expect(res).toEqual(1);
        res = yield table.count({ 'createdtz': new Date('2000-01-01 00:00:00') });
        expect(res).toEqual(1);
        let d = new Date('2000-01-01 00:00:00').toISOString();
        yield table.query(`INSERT INTO ${table} (name, created, createdtz) values ('A2', '${d}'::timestamptz, '${d}'::timestamptz)`);
        res = yield table.findOne({ name: 'A2' });
        expect(res.createdtz).toEqual(new Date('2000-01-01 00:00:00'));
        res = yield table.query(`SELECT * FROM ${table} WHERE name='A2' AND created='${d}'::timestamptz`);
        expect(res.length).toEqual(1);
        res = yield table.query(`SELECT * FROM ${table} WHERE name='A2' AND createdtz='${d}'::timestamptz`);
        expect(res.length).toEqual(1);
    }));
    it("transaction - rollback", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        let res;
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt.schemas[schema]['users'];
        yield tablewt.insert({ name: 'B' });
        res = yield table.count();
        expect(res).toEqual(1);
        res = yield tablewt.count();
        expect(res).toEqual(2);
        yield pgdbwt.transactionRollback();
        res = yield table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');
    }));
    it("transaction - savepoint - rollback", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let tr = yield pgdb.transactionBegin();
        let table = tr.schemas[schema]['users'];
        yield table.insert({ name: 'a' });
        let res = yield table.count();
        expect(res).toEqual(1);
        tr.savePoint('name');
        yield table.insert({ name: 'b' });
        res = yield table.count();
        expect(res).toEqual(2);
        yield tr.transactionRollback({ savePoint: 'name' });
        res = yield table.count();
        expect(res).toEqual(1);
        yield tr.transactionRollback();
        res = yield table.count();
        expect(res).toEqual(0);
    }));
    it("transaction should keep the table definitions", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        const pgDB = pgdb;
        const pgDBTrans = yield pgDB.transactionBegin();
        let list1 = Object.keys(pgDB.tables);
        let list2 = Object.keys(pgDBTrans.tables);
        yield pgDBTrans.transactionCommit();
        expect(list1.length).toEqual(list2.length);
        expect(list1.length > 0).toBeTruthy();
    }));
    it("transaction - commit", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt.schemas[schema]['users'];
        yield tablewt.insert({ name: 'B' });
        let res;
        res = yield table.findAll();
        expect(res.length).toEqual(1);
        expect(res[0].name).toEqual('A');
        res = yield tablewt.count();
        expect(res).toEqual(2);
        yield pgdbwt.transactionCommit();
        res = yield table.findAll();
        expect(res.length).toEqual(2);
        expect(res[0].name).toEqual('A');
        expect(res[1].name).toEqual('B');
    }));
    it("transaction - error + rollback", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        yield tablewt.insert({ name: 'A' });
        try {
            yield tablewt.insertAndGet({ name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100] });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
            yield pgdbwt.transactionRollback();
        }
        let res = yield table.count();
        expect(res).toEqual(0);
    }));
    it("cursor with callback", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', numberList: [1, 2, 3] });
        yield table.insert({ name: 'B' });
        let size = yield table.count();
        let streamSize = 0;
        yield table.queryWithOnCursorCallback(`SELECT * FROM ${table}`, null, null, (r) => {
            streamSize++;
            return true;
        });
        expect(streamSize).toBe(1);
    }));
    it("stream - auto connection handling - normal", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let counter = 0;
        let stream = yield table.queryAsStream(`SELECT * FROM generate_series(0, $1) num`, [1001]);
        stream.on('data', (c) => {
            if (c.num != counter) {
                expect(false).toBeTruthy();
            }
            counter++;
        });
        yield new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(1001 + 1);
    }));
    it("stream - auto connection handling - early close", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let counter = 0;
        let stream = yield table.queryAsStream(`SELECT * FROM generate_series(0,1002) num`);
        yield new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c) => {
                if (counter == 10) {
                    stream.emit('close', 'e');
                    return resolve(undefined);
                }
                counter++;
            });
        });
        expect(counter).toEqual(10);
    }));
    it("stream - auto connection handling - error", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let counter = 0;
        let stillSafe = Number.MAX_SAFE_INTEGER - 5;
        let wrongNum = Number.MAX_SAFE_INTEGER + 100;
        let stream = yield table.queryAsStream(`SELECT * FROM generate_series(${stillSafe}, ${wrongNum}) num`);
        stream.on('data', (c) => {
            counter++;
        });
        yield new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(6);
    }));
    it("stream - with transactions handling - normal", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        yield tablewt.insert({ name: 'A', numberList: [1, 2, 3] });
        yield tablewt.insert({ name: 'B' });
        let counter = 0;
        let stream = yield tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        stream.on('data', (c) => counter++);
        yield new Promise(resolve => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
        expect(counter).toEqual(2);
        counter = yield tablewt.count();
        expect(counter).toEqual(2);
        yield pgdbwt.transactionRollback();
        counter = yield table.count();
        expect(counter).toEqual(0);
    }));
    it("stream - with transactions handling - early close", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        yield tablewt.insert({ name: 'A', numberList: [1, 2, 3] });
        yield tablewt.insert({ name: 'B' });
        yield tablewt.insert({ name: 'C' });
        yield tablewt.insert({ name: 'D' });
        let counter = 0;
        let stream = yield tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        yield new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            stream.on('data', (c) => {
                if (counter == 2) {
                    stream.emit('close', 'e');
                    return resolve(undefined);
                }
                counter++;
            });
        });
        expect(counter).toEqual(2);
        counter = yield tablewt.count();
        expect(counter).toEqual(4);
        yield pgdbwt.transactionRollback();
        counter = yield table.count();
        expect(counter).toEqual(0);
    }));
    it("stream - with transactions handling - error", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        let tablewt = pgdbwt[schema]['users'];
        yield tablewt.insert({ name: 'A', bigNumberList: [1, 2, 3] });
        yield tablewt.insert({ name: 'B' });
        yield tablewt.insert({ name: 'C', bigNumberList: [1, 2, Number.MAX_SAFE_INTEGER + 100] });
        yield tablewt.insert({ name: 'D' });
        let counter = 0;
        let stream = yield tablewt.queryAsStream(`SELECT * FROM ${tablewt}`);
        try {
            stream.on('data', (c) => {
                counter++;
            });
            yield new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
            });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect(/Number can't be represented in javascript/.test(e.message)).toBeTruthy();
        }
        expect(counter).toEqual(2);
        counter = yield tablewt.count();
        expect(counter).toEqual(4);
        yield pgdbwt.transactionRollback();
        counter = yield table.count();
        expect(counter).toEqual(0);
    }));
    it("truncate", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        yield table.insert({ name: 'B' });
        yield table.truncate();
        let size = yield table.count();
        expect(size).toEqual(0);
    }));
    it("truncate + special types", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield pgdb.setTypeParser('permissionForResourceType', (val) => parseComplexType(val));
        yield pgdb.setTypeParser('_permissionForResourceType', (val) => val == "{}" ? [] : parseComplexTypeArray(val));
        yield table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'
            ],
        });
        yield table.truncate();
        yield table.insert({
            name: 'Piszkos Fred',
            permission: "(read,book)",
            permissionList: [
                '(admin,"chaos j ()"",""""j ,")',
                '(write,book)',
                '(write,)',
                '(,"")',
                '(,)',
                '(write,null)'
            ],
        });
        let pf = yield table.findOne({ name: 'Piszkos Fred' });
        expect(pf.permission).toEqual(['read', 'book']);
        expect(pf.permissionList[0]).toEqual(['admin', 'chaos j ()",""j ,']);
    }));
    it("truncate - cascade", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let g = yield tableGroups.insertAndGet({ name: 'G' });
        yield table.insert({ name: 'A', mainGroup: g.id });
        yield table.insert({ name: 'B', mainGroup: g.id });
        yield tableGroups.truncate({ cascade: true, restartIdentity: true });
        let size = yield table.count();
        expect(size).toEqual(0);
        let g2 = yield tableGroups.insertAndGet({ name: 'G' }, { return: ['id'] });
        expect(g.id >= g2.id).toBeTruthy();
    }));
    it("orderBy", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'B' });
        yield table.insert({ name: 'C', aCategory: 'C' });
        yield table.insert({ name: 'A2', aCategory: 'A' });
        yield table.insert({ name: 'B2', aCategory: 'B' });
        yield table.insert({ name: 'C2', aCategory: 'C' });
        let res;
        res = yield table.find({}, { orderBy: ['aCategory', 'name'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);
        res = yield table.find({}, { orderBy: { 'aCategory': 'asc', 'name': 'asc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);
        res = yield table.find({}, { orderBy: ['aCategory asc', 'name desc'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
        res = yield table.find({}, { orderBy: { 'aCategory': 'asc', 'name': 'desc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
        res = yield table.find({}, { orderBy: ['+aCategory', '-name'], fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
        res = yield table.find({}, { orderBy: '"aCategory" asc, name desc', fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
        res = yield table.find({}, { orderBy: { '"aCategory"': 'asc', 'name': 'desc' }, fields: ['name'] });
        expect(res.map(v => v.name)).toEqual(['A2', 'A', 'B2', 'B', 'C2', 'C']);
    }));
    it("orderBy - sqlInjection", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'B' });
        yield table.insert({ name: 'C', aCategory: 'C' });
        yield table.insert({ name: 'A2', aCategory: 'A' });
        yield table.insert({ name: 'B2', aCategory: 'B' });
        yield table.insert({ name: 'C2', aCategory: 'C' });
        let res;
        res = yield table.find({}, { orderBy: ['aCategory', 'name'], fields: ['name'], forceEscapeColumns: true });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);
        res = yield table.find({}, { orderBy: ['"aCategory"', 'name'], fields: ['name'], forceEscapeColumns: false });
        expect(res.map(v => v.name)).toEqual(['A', 'A2', 'B', 'B2', 'C', 'C2']);
        try {
            res = yield table.find({}, { orderBy: ['random()', 'name'], fields: ['name'], forceEscapeColumns: true });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toBe('error: column "random()" does not exist');
        }
        res = yield table.find({}, { orderBy: ['random()', 'name'], fields: ['name'], forceEscapeColumns: false });
        expect(res.length).toEqual(6);
        try {
            res = yield table.find({}, { orderBy: ['aCategory/*", "*/name'], fields: ['aCategory', 'name'], forceEscapeColumns: true });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toBe('error: column "aCategory/*", "*/name" does not exist');
        }
        try {
            res = yield table.find({}, { orderBy: ['1, random()'], fields: ['aCategory', 'name'], forceEscapeColumns: true });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toBe('error: column "1, random()" does not exist');
        }
        try {
            res = yield table.find({}, { orderBy: ['aCategory\", random() \"'], fields: ['name'], forceEscapeColumns: { orderBy: true } });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toBe('error: column "aCategory", random()" does not exist');
        }
    }));
    it("stored proc", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold' });
        yield table.insert({ name: 'B', membership: 'gold' });
        expect(pgdb[schema].fn['list_gold_users']).toBeDefined();
        expect(pgdb.fn['increment']).toBeDefined();
        let s = yield pgdb.run('select current_schema');
        console.log(s);
        let res = yield pgdb[schema].fn['list_gold_users']();
        console.log(res);
        expect(res).toEqual(['A', 'B']);
        res = yield pgdb.fn['increment'](3);
        console.log(res);
        expect(res).toEqual(4);
    }));
    it("executing sql file - if there is an exception, should be thrown", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let ex = null;
        try {
            yield pgdb.execute('src/test/throw_exception.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
        }
        catch (e) {
            ex = e;
        }
        expect('' + ex).toEqual("error: division_by_zero");
    }));
    it("select/update/delete should throw exception if the condition contains undefined value", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', membership: 'gold' });
        let conditions = { name: 'A', membership: undefined };
        try {
            yield table.find(conditions);
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        let res = yield table.find(conditions, { skipUndefined: true });
        expect(res.length == 1).toBeTruthy();
        try {
            yield table.update(conditions, { name: 'B' });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        yield table.update(conditions, { name: 'B' }, { skipUndefined: true });
        res = yield table.find(conditions, { skipUndefined: true });
        expect(res.length == 0).toBeTruthy();
        try {
            conditions.name = 'B';
            yield table.delete(conditions);
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual('Error: Invalid conditions! Field value undefined: "membership". Either delete the field, set it to null or use the options.skipUndefined parameter.');
        }
        yield table.delete(conditions, { skipUndefined: true });
        res = yield table.findAll();
        expect(res.length == 0).toBeTruthy();
    }));
    it("Testing deleteAndGet ", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        let res = yield table.deleteAndGetOne({ name: 'A' });
        expect(res != null).toBeTruthy();
        expect(res.name == 'A').toBeTruthy();
        let res2 = yield table.deleteAndGetOne({ name: 'A' });
        expect(res2 == null).toBeTruthy();
    }));
    it("Testing postprocess function", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A' });
        pgdb.setPostProcessResult((res, fields, logger) => {
            res[0].name = 'B';
        });
        let res = yield pgdb.query(`select * from ${table}`);
        expect(res[0].name == 'B').toBeTruthy();
        res = yield table.findAll();
        expect(res[0].name == 'B').toBeTruthy();
        pgdb.setPostProcessResult(null);
        res = yield table.findAll();
        expect(res[0].name == 'A').toBeTruthy();
    }));
    it("Testing deleteAndGet", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert([{ name: 'A' }, { name: 'B' }]);
        let res = yield table.deleteAndGet({ name: ['A', 'B'] });
        expect(res.length == 2).toBeTruthy();
    }));
    it("Testing sql execution", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield pgdb.execute('src/test/tricky.sql', (cmd) => cmd.replace(/__SCHEMA__/g, '"' + schema + '"'));
    }));
    it("Testing text array parsing", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let list = ["'A'", '"A"', 'normal', '//', '\\', '\\\\\\"', '\\\\"', '\\"', '""', "''", '--', '/*', '', '<!--', JSON.stringify({
                a: 1,
                b: "aprocska\"kalapocska'bennecsacskamacskamocska"
            })];
        yield table.insert({ name: 'A', textList: list });
        let rec = yield table.findOne({ name: 'A' });
        console.log(list + '\n' + rec.textList);
        let isDifferent = list.some((v, i) => rec.textList[i] !== v);
        expect(isDifferent).toBeFalsy();
    }));
    it("Testing jsonb array parsing", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let list = [{
                "id": "fl1ace84f744",
                "name": "Wire 2017-09-17 at 11.57.55.png",
                "type": "image/png",
                "path": "/data/files/fl1ace84f744/Wire 2017-09-17 at 11.57.55.png",
                "title": "Wire 2017-09-17 at 11.57.55"
            }];
        yield table.insert({ name: 'A', jsonbList: list });
        let rec = yield table.findOne({ name: 'A' });
        console.log('xxx', rec.jsonbList, typeof rec.jsonbList[0]);
        console.log(JSON.stringify(list) + '\n' + JSON.stringify(rec.jsonbList));
        let isDifferent = list.some((v, i) => !_.isEqual(rec.jsonbList[i], v));
        expect(isDifferent).toBeFalsy();
    }));
    it("Testing distinct", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'A' });
        let recs = yield table.find({ aCategory: 'A' }, { fields: ['aCategory'], distinct: true });
        expect(recs.length).toEqual(1);
    }));
    it("Testing queryOne", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'A' });
        try {
            let recs = yield table.queryOne(`SELECT * FROM ${table} WHERE "aCategory" = 'A'`);
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual("Error: More then one rows exists");
        }
    }));
    it("Testing queryFirst", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'A' });
        let rec = yield table.queryFirst(`SELECT * FROM ${table} WHERE "aCategory" = 'A'`);
        expect(rec.aCategory).toEqual('A');
    }));
    it("Testing forUpdate", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        let pgdb1 = yield table.db.transactionBegin();
        yield pgdb1.tables['users'].find({ aCategory: 'A' }, { forUpdate: true });
        let p = table.update({ aCategory: 'A' }, { name: 'C' });
        yield new Promise(resolve => setTimeout(resolve, 500));
        yield pgdb1.tables['users'].update({ aCategory: 'A' }, { name: 'B' });
        yield pgdb1.transactionCommit();
        yield p;
        let rec = yield table.findFirst({ aCategory: 'A' });
        expect(rec.name).toEqual('C');
    }));
    it("Testing update where something is null", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.update({ textList: null }, { name: 'B' });
        let rec = yield table.findFirst({ aCategory: 'A' });
        expect(rec.name).toEqual('B');
    }));
    it("Testing query with array equals", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'A' });
        yield table.insert({ name: 'C', aCategory: 'A' });
        let recs = yield table.find({ name: ['A', 'B'] });
        expect(recs.length).toEqual(2);
    }));
    it("Testing query with array not equals", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        yield table.insert({ name: 'B', aCategory: 'A' });
        yield table.insert({ name: 'C', aCategory: 'A' });
        let recs = yield table.find({ '"name" !=': ['A', 'B'] });
        expect(recs.length).toEqual(1);
    }));
    it("Testing empty result with one field", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let recs = yield table.queryOneColumn(`select name from ${table}`);
        expect(recs.length).toEqual(0);
    }));
    it("Testing empty result with one column", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let rec = yield table.queryOneField(`select name from ${table}`);
        expect(rec).toEqual(null);
    }));
    it("Testing NOTIFY and LISTEN (listen)", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let called = null;
        let payload = 'hello';
        yield table.db.listen('test_channel', (notification) => called = notification.payload);
        yield table.db.notify('test_channel', payload);
        yield new Promise((resolve) => setTimeout(resolve, 1000));
        expect(called).toEqual(payload);
    }));
    it("Testing NOTIFY and LISTEN (unlisten)", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let called = null;
        let payload = 'hello';
        yield table.db.listen('test_channel', (notification) => called = notification.payload);
        yield table.db.unlisten('test_channel');
        yield table.db.notify('test_channel', payload);
        yield new Promise((resolve) => setTimeout(resolve, 1000));
        expect(called).toEqual(null);
    }));
    it("Testing Empty 'or' condition", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        let recs = yield table.find({ or: [] });
        expect(recs.length).toEqual(1);
    }));
    it("Testing Empty 'and' condition", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        let recs = yield table.find({ and: [] });
        expect(recs.length).toEqual(1);
    }));
    it("Testing row mode", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield table.insert({ name: 'A', aCategory: 'A' });
        let result = yield table.queryAsRows(`select * from ${table}`);
        expect(result.rows.length).toEqual(1);
        expect(result.columns.includes('id'));
        expect(result.columns.includes('name'));
        expect(result.columns.includes('aCategory'));
    }));
    it("Testing output formats of default types", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        yield tableTypes.insert({
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
        let result = yield tableTypes.findFirst({});
        expect(result.text).toEqual('apple');
        expect(result.int).toEqual(23);
        expect(result.bigInt).toEqual(233);
        expect(result.real).toEqual(0.5);
        expect(result.double).toEqual(0.25);
        expect(result.bool).toEqual(false);
        expect(result.json.bool).toEqual(true);
        expect(result.json.number).toEqual(12);
        expect(typeof result.json.date).toEqual('string');
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
    }));
    it("Testing output formats of enum types - query", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        yield table.insert({ m: 'sad' });
        let result = yield table.findFirst({});
        expect(result.m).toEqual('sad');
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        result = yield table.findFirst({});
        expect(result.m).toEqual('sad');
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum types - queryWithOnCursorCallback without stop", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        yield table.insert([{ m: 'sad' }, { m: 'sad' }]);
        let counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
        });
        expect(counter).toEqual(2);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
        });
        expect(counter).toEqual(2);
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum types - queryWithOnCursorCallback with stop", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        yield table.insert([{ m: 'sad' }, { m: 'sad' }]);
        let counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumTable"`, [], {}, (data) => {
            expect(data.m).toEqual('sad');
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum types - queryAsStream", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumTable" (m ${schema}.mood NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumTable"];
        yield table.insert({ m: 'sad' });
        let stream = yield table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual('sad');
        });
        yield new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.on('close', resolve);
        });
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumTable" ALTER COLUMN m TYPE ${schema}.mood_new USING m::text::${schema}.mood_new;
        `);
        stream = yield table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual('sad');
        });
        try {
            yield new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('close', resolve);
            });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual('Error: [337] Query returns fields with unknown oid.');
        }
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum array types - query", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        yield table.insert({ m: ['sad', 'ok'] });
        let result = yield table.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        result = yield table.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum array types - queryWithOnCursorCallback without stop", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        yield table.insert([{ m: ['sad', 'ok'] }, { m: ['sad', 'ok'] }]);
        let counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
        });
        expect(counter).toEqual(2);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
        });
        expect(counter).toEqual(2);
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum array types - queryWithOnCursorCallback with stop", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        yield table.insert([{ m: ['sad', 'ok'] }, { m: ['sad', 'ok'] }]);
        let counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        counter = 0;
        yield table.queryWithOnCursorCallback(`select * from ${schema}."enumArrayTable"`, [], {}, (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
            ++counter;
            return true;
        });
        expect(counter).toEqual(1);
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum array types - queryAsStream", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        yield table.insert({ m: ['sad', 'ok'] });
        let stream = yield table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
        });
        yield new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.on('close', resolve);
        });
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
        `);
        stream = yield table.find({}, { stream: true });
        stream.on("data", (data) => {
            expect(data.m).toEqual(['sad', 'ok']);
        });
        try {
            yield new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.on('close', resolve);
            });
            expect(false).toBeTruthy();
        }
        catch (e) {
            expect('' + e).toEqual('Error: [337] Query returns fields with unknown oid.');
        }
        yield pgdbwt.transactionRollback();
    }));
    it("Testing output formats of enum array types - query on view", () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
        let pgdbwt = yield pgdb.transactionBegin();
        yield pgdbwt.run(`DROP TYPE IF EXISTS ${schema}.mood CASCADE`);
        yield pgdbwt.run(`DROP TABLE IF EXISTS ${schema}."enumArrayTable"`);
        yield pgdbwt.run(`CREATE TYPE ${schema}.mood AS ENUM ('sad', 'ok', 'happy')`);
        yield pgdbwt.run(`CREATE TABLE ${schema}."enumArrayTable" (m ${schema}.mood[] NULL)`);
        yield pgdbwt.run(`CREATE VIEW ${schema}."enumArrayTableView" as select m from ${schema}."enumArrayTable"`);
        yield pgdbwt.reload();
        let table = pgdbwt.schemas[schema].tables["enumArrayTable"];
        yield table.insert({ m: ['sad', 'ok'] });
        let view = pgdbwt.schemas[schema].tables["enumArrayTableView"];
        let result = yield view.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);
        yield pgdbwt.run(`
            CREATE TYPE ${schema}.mood_new AS ENUM ('sad', 'ok', 'happy', 'other');
            DROP VIEW ${schema}."enumArrayTableView";
            ALTER TABLE ${schema}."enumArrayTable" ALTER COLUMN m TYPE ${schema}.mood_new[] USING m::text[]::${schema}.mood_new[];
            CREATE VIEW ${schema}."enumArrayTableView" as select m from ${schema}."enumArrayTable"
        `);
        result = yield view.findFirst({});
        expect(result.m).toEqual(['sad', 'ok']);
        yield pgdbwt.transactionRollback();
    }));
});
//# sourceMappingURL=pgDb.test.js.map