import { Notification, PgDb } from "../pgDb";
import * as yargs from 'yargs';
import * as shell from "shelljs";

// cd ~/labcup/ ; docker-compose start
// cd ~/labcup/ ; docker-compose stop
let argv: any = yargs
    .usage('node pgServiceRestartTest.js\n Usage: $0')
    .option('postgresOn', {
        describe: 'the command line command which switches on the postgresql server',
        type: "string"
    })
    .option('postgresOff', {
        describe: 'the command line command which switches off the postgresql server',
        type: "string"
    })
    .option('testParams', {
        describe: 'check postgres Off & On params',
        type: "boolean"
    })
    .argv;

async function runCommand(command: string, options?: { silent: boolean }): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolve, reject) => {
        shell.exec(command, { silent: options ? options.silent : true }, (code: number, stdout: string, stderr: string) => {
            resolve({ stdout, stderr });
        });
    });
}

async function asyncWaitMs(ms: number) {
    await new Promise(r => setTimeout(r, ms));
}

function syncWaitMs(ms: number) {
    let origDate = +new Date();
    let actDate = origDate;
    while (origDate + ms > actDate) {
        actDate = +new Date();
    }
}

async function postgresOff() {
    console.log('Kill postgres server.');
    await runCommand(argv.postgresOff);
}

async function postgresOn() {
    console.log('Start postgres server.');
    await runCommand(argv.postgresOn);
    await asyncWaitMs(500);
}

const poolSize = 3;

async function testSchemaClear(db: PgDb) {
    await db.run(`drop table if exists pgdb_test.names`);

    await db.run(`DROP TYPE IF EXISTS pgdb_test.mood CASCADE`);
    await db.run(`DROP TABLE IF EXISTS pgdb_test."enumArrayTable"`);
}

async function testSchemaInit(db: PgDb) {
    await testSchemaClear(db);
    await db.run(`create table pgdb_test.names (name varchar null)`);
    await db.run(`insert into pgdb_test.names (name) values ('Kuka'), ('Hapci')`);

    await db.run(`CREATE TYPE pgdb_test.mood AS ENUM('sad', 'ok', 'happy')`);
    await db.run(`CREATE TABLE pgdb_test."enumArrayTable"(m pgdb_test.mood[] NULL)`);
    await db.run(`INSERT INTO pgdb_test."enumArrayTable"(m) values (ARRAY['sad'::pgdb_test.mood, 'happy'::pgdb_test.mood])`);
}

async function testDbFreeConnections(db: PgDb): Promise<Error> {
    let dedicatedConnections: PgDb[] = new Array(poolSize).fill(null);

    await Promise.race([
        asyncWaitMs(1000),
        (async () => {
            for (let i = 0; i < dedicatedConnections.length; ++i) {
                dedicatedConnections[i] = await db.dedicatedConnectionBegin();
            }
        })()
    ]);
    if (dedicatedConnections.some(v => !v)) {
        return new Error('Some of the connections are not free!');
    }
    for (let conn of dedicatedConnections) {
        await conn.dedicatedConnectionEnd();
    }
    return null;
}

async function testInsertQuery(db: PgDb): Promise<Error> {
    let tableContents = await db.query(`select * from pgdb_test.names`);
    if (tableContents.length != 2) {
        return new Error('Simple query fails');
    }
    let callbackCounter1 = 0;
    await db.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, (data) => {
        ++callbackCounter1;
    });
    if (callbackCounter1 != 2) {
        return new Error('Query with cursor callback fails');
    }

    let callbackCounter2 = 0;
    let stream = await db.queryAsStream(`select * from pgdb_test.names`);
    await new Promise<any>((resolve, reject) => {
        stream.on("data", (data) => {
            ++callbackCounter2;
        });
        stream.on('error', reject);
        stream.on('close', resolve);
    });
    if (callbackCounter2 != 2) {
        return new Error('Query as stream fails');
    }
    return null;
}

async function testNotificationSystem(db: PgDb): Promise<Error> {
    let result: string;
    await db.listen('testChannel', (data) => { result = data.payload; });
    await db.notify('testChannel', 'newData');
    await asyncWaitMs(1000);
    if (result != 'newData') {
        return new Error('Notification not working...');
    }
    await db.unlisten('testChannel');
}

async function testDbUsability(db: PgDb): Promise<Error> {
    try {
        console.log('TestSchemaInit');
        await testSchemaInit(db);
        console.log('TestFreeConnections');
        let error = await testDbFreeConnections(db);
        if (!error) {
            console.log('TestInsertQueries');
            error = await testInsertQuery(db);
        }
        if (!error) {
            console.log('TestNotifications');
            error = await testNotificationSystem(db);
        }
        await testSchemaClear(db);
        return error;
    } catch (e) {
        return e;
    }
}

interface TestDescriptor {
    name: string,
    fn: (db: PgDb, isTrue: (value: boolean) => void) => Promise<void>,
    skipTestDb?: boolean
}

async function runTestInternal(db: PgDb, test: TestDescriptor): Promise<Error> {
    let callCounter = 0;

    let errorResult: Error = null;
    try {
        await test.fn(db, (value: boolean) => {
            ++callCounter;
            if (!value && !errorResult) {
                errorResult = new Error(`Error in test at the ${callCounter}. call.`);
            }
        });
    } catch (err) {
        if (!errorResult) {
            errorResult = err;
        }
    }

    await postgresOn();

    if (!errorResult && !test.skipTestDb) {
        errorResult = await testDbUsability(db);
    }
    return errorResult;
}

let actTestCounter: number = 0;
let errorMessages: { testName: string, err: Error }[] = [];

async function runTest(allTestCount: number, test: TestDescriptor) {
    ++actTestCounter;
    console.log('====================================================================================');
    console.log(`${actTestCounter}/${allTestCount} Test starting: "${test.name}"`);
    console.log('====================================================================================');

    await postgresOn();
    let db = await PgDb.connect({
        poolSize,
        logger: {
            log: console.log,
            error: console.error
        }
    });
    await testSchemaInit(db);

    let error = await runTestInternal(db, test);
    if (error) {
        errorMessages.push({ testName: test.name, err: error });
    }

    await db.close();
    console.log('====================================================================================');
    if (error) {
        console.log(`${actTestCounter}/${allTestCount} Test errored: "${test.name}"`);
    } else {
        console.log(`${actTestCounter}/${allTestCount} Test passed: "${test.name}"`);
    }
    console.log('====================================================================================');
}

let newConnectionTests: TestDescriptor[] = [
    {
        name: 'simple query 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                await db.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'simple query 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                await db.query(`select * from pgdb_test."enumArrayTable"`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db.query(`select * from pgdb_test."enumArrayTable"`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'queryWithCallback 1 - postgresOff before call',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                await db.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, () => {
                    isTrue(false);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'queryWithCallback 2 - postgresOff between calls',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v, i) => `'Smith${i}'`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test.names(name) values ${params}`);
            let i = 0;
            let fn1 = async () => {
                try {
                    await db.queryWithOnCursorCallback('select * from pgdb_test.names', {}, {}, (data) => {
                        syncWaitMs(20);
                        ++i;
                        if (i % 10 == 0) {
                            console.log('Record:', i);
                        }
                    });
                    isTrue(false);
                } catch (e) {
                    ++stageCounter;
                }
            }
            let fn2 = async () => {
                console.log('Wait before postgres off...');
                await asyncWaitMs(100);
                await postgresOff();
            }
            await Promise.all([fn1(), fn2()]);
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 1);
        },
    },
    {
        name: 'queryWithCallback 3 - postgresOff between calls, unknown oid',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v) => `ARRAY['sad'::pgdb_test.mood, 'happy'::pgdb_test.mood]`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test."enumArrayTable"(m) values ${params}`);

            let i = 0;
            let fn1 = async () => {
                try {
                    await db.queryWithOnCursorCallback('select * from pgdb_test."enumArrayTable"', {}, {}, (data) => {
                        syncWaitMs(20);
                        ++i;
                        if (i % 10 == 0) {
                            console.log('Record:', i);
                        }
                    });
                    isTrue(false);
                } catch (e) {
                    ++stageCounter;
                }
            }
            let fn2 = async () => {
                console.log('Wait before postgres off...');
                await asyncWaitMs(100);
                await postgresOff();
            }
            await Promise.all([fn1(), fn2()]);
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 1);
        },
    },
    {
        name: 'queryAsStream 1 - postgresOff before call',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                let stream = await db.queryAsStream(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'queryAsStream 2 - postgresOff between calls',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v, i) => `'Smith${i}'`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test.names(name) values ${params}`);

            let stream = await db.queryAsStream('select * from pgdb_test.names');

            let i = 0;
            let promise1 = new Promise<any>((resolve, reject) => {
                stream.on("data", (data) => {
                    syncWaitMs(20);
                    ++i;
                    if (i % 10 == 0) {
                        console.log(data.name);
                    }
                });
                stream.on('error', (...params) => {
                    ++stageCounter;
                    reject(...params);
                });
                stream.on('close', resolve);
            });

            let fn2 = async () => {
                await asyncWaitMs(100);
                await postgresOff();
            }
            try {
                await Promise.all([promise1, fn2()]);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'queryAsStream 3 - postgresOff between calls, unknown oid',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v) => `ARRAY['sad'::pgdb_test.mood, 'happy'::pgdb_test.mood]`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test."enumArrayTable"(m) values ${params}`);

            let stream = await db.queryAsStream('select * from pgdb_test."enumArrayTable"');
            let i = 0;
            let promise1 = new Promise<any>((resolve, reject) => {
                stream.on("data", (data) => {
                    syncWaitMs(20);
                    ++i;
                    if (i % 10 == 0) {
                        console.log(data.name);
                    }
                });
                stream.on('error', (...params) => {
                    ++stageCounter;
                    reject(...params);
                });
                stream.on('close', resolve);
            });

            let fn2 = async () => {
                await asyncWaitMs(100);
                await postgresOff();
            }
            try {
                await Promise.all([promise1, fn2()]);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i == 0);
            isTrue(stageCounter == 2);
            await postgresOff(); // To ensure, that postgresql stopped perfectly.
        }
    },
];

let dedicatedConnection_SimpleQueryTests: TestDescriptor[] = [
    {
        name: 'dedicated connection - empty 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                let db0 = await db.dedicatedConnectionBegin();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection - empty 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection - simple query 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection - simple query 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'dedicated connection - simple query 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await db0.run(`truncate pgdb_test.names`)
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result[0].name == 'Morgo');
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection - simple query 4',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await db0.run(`truncate pgdb_test.names`)
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result[0].name == 'Morgo');
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection - simple query 5',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await db0.run(`truncate pgdb_test.names`)
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result[0].name == 'Morgo');
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'dedicated connection - simple query 6',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await db0.run(`truncate pgdb_test.names`)
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result[0].name == 'Morgo');
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'transaction - simple query 7',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result.length == 0);
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'transaction - simple query 8',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            try {
                await db0.transactionCommit();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result.length == 0);
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'transaction - simple query 9',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.transactionCommit();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result.length == 0);
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'transaction - simple query 10',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result.length == 0);
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'transaction - simple query 11',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.transactionCommit();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            let result = await db.query(`select * from pgdb_test.names`);
            isTrue(result.length == 0);
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'transaction - rollback 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await postgresOff();
            try {
                await db0.transactionRollback();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'transaction - rollback 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
            await postgresOff();
            try {
                await db0.transactionRollback();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'transaction - rollback 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await postgresOff();
            try {
                await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.transactionRollback();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'transaction - rollback 4',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await db.run(`truncate pgdb_test.names`)
            let db0 = await db.transactionBegin();
            await postgresOff();
            try {
                await db0.run(`insert into pgdb_test.names (name) values ('Morgo')`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            await postgresOn();
            try {
                await db0.transactionRollback();
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 2);
        }
    }
];

let dedicatedConnection_StreamQueryTests: TestDescriptor[] = [
    {
        name: 'dedicated connection queryWithCallback - 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            let i = 0;
            try {
                await db0.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, (data) => { ++i });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i == 0);
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'dedicated connection queryWithCallback - 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            let i = 0;
            try {
                await db0.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, (data) => { ++i });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(i == 0);
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'dedicated connection queryWithCallback - 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            let i = 0;
            try {
                await db0.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, (data) => { ++i });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i == 0);
            isTrue(stageCounter == 2);
        }
    },
    {
        name: 'dedicated connection queryWithCallback 4 - postgresOff between calls',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v, i) => `'Smith${i}'`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test.names(name) values ${params}`);

            let db0 = await db.dedicatedConnectionBegin();
            let i = 0;
            let fn1 = async () => {
                try {
                    await db0.queryWithOnCursorCallback('select * from pgdb_test.names', {}, {}, (data) => {
                        syncWaitMs(20);
                        ++i;
                        if (i % 10 == 0) {
                            console.log('Record:', i);
                        }
                    });
                    isTrue(false);
                } catch (e) {
                    ++stageCounter;
                }
            }
            let fn2 = async () => {
                console.log('Wait before postgres off...');
                await asyncWaitMs(100);
                await postgresOff();
            }
            await Promise.all([fn1(), fn2()]);
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 1);
        },
    },
    {
        name: 'dedicated connection queryWithCallback 5 - postgresOff between calls, unknown oid',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v) => `ARRAY['sad'::pgdb_test.mood, 'happy'::pgdb_test.mood]`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test."enumArrayTable"(m) values ${params}`);

            let db0 = await db.dedicatedConnectionBegin();
            let i = 0;
            let fn1 = async () => {
                try {
                    await db0.queryWithOnCursorCallback('select * from pgdb_test."enumArrayTable"', {}, {}, (data) => {
                        syncWaitMs(20);
                        ++i;
                        if (i % 10 == 0) {
                            console.log('Record:', i);
                        }
                    });
                    isTrue(false);
                } catch (e) {
                    ++stageCounter;
                }
            }
            let fn2 = async () => {
                console.log('Wait before postgres off...');
                await asyncWaitMs(100);
                await postgresOff();
            }
            await Promise.all([fn1(), fn2()]);
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 1);
        },
    },

    {
        name: 'dedicated connection queryAsStream - 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            let stream;
            try {
                stream = await db0.queryAsStream(`select * from pgdb_test.names`);
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            try {
                await new Promise<any>((resolve, reject) => {
                    stream.on("data", (data) => {
                        isTrue(false);
                    });
                    stream.on('error', (...params) => {
                        ++stageCounter;
                        reject(...params);
                    });
                    stream.on('close', resolve);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 3);
        }
    },
    {
        name: 'dedicated connection queryAsStream - 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            let stream;
            try {
                stream = await db0.queryAsStream(`select * from pgdb_test.names`);
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            try {
                await new Promise<any>((resolve, reject) => {
                    stream.on("data", (data) => {
                        isTrue(false);
                    });
                    stream.on('error', (...params) => {
                        ++stageCounter;
                        reject(...params);
                    });
                    stream.on('close', resolve);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(stageCounter == 4);
        }
    },
    {
        name: 'dedicated connection queryAsStream - 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            let stream;
            try {
                stream = await db0.queryAsStream(`select * from pgdb_test.names`);
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            try {
                await new Promise<any>((resolve, reject) => {
                    stream.on("data", (data) => {
                        isTrue(false);
                    });
                    stream.on('error', (...params) => {
                        ++stageCounter;
                        reject(...params);
                    });
                    stream.on('close', resolve);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 4);
        }
    },
    {
        name: 'dedicated connection queryAsStream 4 - postgresOff between calls',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v, i) => `'Smith${i}'`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test.names(name) values ${params}`);

            let db0 = await db.dedicatedConnectionBegin();
            let stream = await db0.queryAsStream('select * from pgdb_test.names');

            let i = 0;
            let promise1 = new Promise<any>((resolve, reject) => {
                stream.on("data", (data) => {
                    syncWaitMs(20);
                    ++i;
                    if (i % 10 == 0) {
                        console.log(data.name);
                    }
                });
                stream.on('error', (...params) => {
                    ++stageCounter;
                    reject(...params);
                });
                stream.on('close', resolve);
            });

            let fn2 = async () => {
                await asyncWaitMs(100);
                await postgresOff();
            }
            try {
                await Promise.all([promise1, fn2()]);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i > 0 && i < 2000);
            isTrue(stageCounter == 2);
        },
    },
    {
        name: 'dedicated connection queryAsStream 5 - postgresOff between calls, unknown oid',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;

            let params = new Array(2000).fill(null).map((v) => `ARRAY['sad'::pgdb_test.mood, 'happy'::pgdb_test.mood]`).map(v => `(${v})`).join(', ');
            await db.run(`INSERT INTO pgdb_test."enumArrayTable"(m) values ${params}`);

            let db0 = await db.dedicatedConnectionBegin();
            let stream = await db0.queryAsStream('select * from pgdb_test."enumArrayTable"');
            let i = 0;
            let promise1 = new Promise<any>((resolve, reject) => {
                stream.on("data", (data) => {
                    syncWaitMs(20);
                    ++i;
                    if (i % 10 == 0) {
                        console.log(data.name);
                    }
                });
                stream.on('error', (...params) => {
                    ++stageCounter;
                    reject(...params);
                });
                stream.on('close', resolve);
            });

            let fn2 = async () => {
                await asyncWaitMs(100);
                await postgresOff();
            }
            try {
                await Promise.all([promise1, fn2()]);
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(i == 0);
            isTrue(stageCounter == 2);
            await postgresOff(); // To ensure, that postgresql stopped perfectly.
        },
    }
];

let postgresRestartTests: TestDescriptor[] = [
    {
        name: 'postgres restart 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            await postgresOn();
            try {
                await db0.dedicatedConnectionEnd();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'postgres restart 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.transactionBegin();
            await postgresOff();
            await postgresOn();
            try {
                await db0.transactionRollback();
                isTrue(false);
            } catch (e) {
                ++stageCounter;

            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'postgres restart 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            await postgresOn();
            try {
                let result = await db0.query(`select * from pgdb_test.names`);
                isTrue(false);
            } catch (e) {
                ++stageCounter;

            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'postgres restart 4',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            await postgresOn();
            try {
                let result = await db0.queryWithOnCursorCallback(`select * from pgdb_test.names`, {}, {}, (data) => {
                    isTrue(false);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;

            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'postgres restart 5',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            await postgresOn();
            let stream;
            try {
                stream = await db0.queryAsStream(`select * from pgdb_test.names`);
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            try {
                await new Promise<any>((resolve, reject) => {
                    stream.on("data", (data) => {
                        isTrue(false);
                    });
                    stream.on('error', (...params) => {
                        ++stageCounter;
                        reject(...params);
                    });
                    stream.on('close', resolve);
                });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 3);
        }
    },
];

let postgresEndTests: TestDescriptor[] = [
    {
        name: 'postgres end 1',
        skipTestDb: true,
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            let db0 = await db.dedicatedConnectionBegin();
            await postgresOff();
            try {
                await db.close();
                ++stageCounter;
            } catch (e) {
                isTrue(false);
            }
            isTrue(stageCounter == 1);
        }
    }
]

let notifyTests: TestDescriptor[] = [
    {
        name: 'notification 1',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let stageCounter = 0;
            await postgresOff();
            try {
                await db.listen('newChannel', (notif) => { });
                isTrue(false);
            } catch (e) {
                ++stageCounter;
            }
            isTrue(stageCounter == 1);
        }
    },
    {
        name: 'notification 2',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            await db.listen('newChannel', (notif) => { });
            await postgresOff();
            await postgresOn();
            await db.unlisten('newChannel');
        }
    },
    {
        name: 'notification 3',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let result: string;
            await db.listen('newChannel', (notif) => { result = notif.payload });
            await postgresOff();
            await postgresOn();
            await db.notify('newChannel', 'newValue');
            await asyncWaitMs(1000);
            isTrue(result == 'newValue');
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 4',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let result: string;
            await db.listen('newChannel', (notif) => { result = notif.payload });
            await postgresOff();
            await postgresOn();
            await db.run(`notify "newChannel", 'newValue'`);
            await asyncWaitMs(1000);
            isTrue(result == 'newValue');
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 5',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let result: string;
            await db.listen('newChannel', (notif) => { result = notif.payload });
            await postgresOff();
            await postgresOn();
            let db0 = await db.dedicatedConnectionBegin();
            await db0.run(`notify "newChannel", 'newValue'`);
            await asyncWaitMs(1000);
            isTrue(result == 'newValue');
            await db.unlisten('newChannel'); //To empty the queue
            await db0.dedicatedConnectionEnd();
        }
    },
    {
        name: 'notification 6',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            let fn2 = (notif: Notification) => { i += 2 * (+notif.payload) };
            await db.listen('newChannel', fn1);
            await postgresOff();
            await db.listen('newChannel', fn2);
            await postgresOn();
            await db.notify('newChannel', '1');
            await asyncWaitMs(1000);
            isTrue(i == 3);
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 7',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            let fn2 = (notif: Notification) => { i += 2 * (+notif.payload) };
            await db.listen('newChannel', fn1);
            await postgresOff();
            await db.listen('newChannel', fn2);
            await db.unlisten('newChannel', fn1);
            await postgresOn();
            await db.notify('newChannel', '1');
            await asyncWaitMs(1000);
            isTrue(i == 2);
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 8',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let j = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            let fn2 = (notif: Notification) => { j += +notif.payload };
            await db.listen('newChannel', fn1);
            await postgresOff();
            try {
                await db.listen('newChannel2', fn2);
                isTrue(false);
            } catch (e) {
            }
            await postgresOn();
            await db.notify('newChannel', '1');
            await db.notify('newChannel2', '1');
            await asyncWaitMs(1000);
            isTrue(i == 1);
            isTrue(j == 0);
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 9',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            await db.listen('newChannel', fn1);
            await postgresOff();
            try {
                await db.unlisten('newChannel', fn1);
                isTrue(false);
            } catch (e) {
            }
            await postgresOn();
            await db.notify('newChannel', '1');
            await asyncWaitMs(1000);
            isTrue(i == 1);
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 10',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            await db.listen('newChannel', fn1);
            await postgresOff();
            try {
                await db.unlisten('newChannel');
                isTrue(false);
            } catch (e) {
            }
            await postgresOn();
            await db.notify('newChannel', '1');
            await asyncWaitMs(1000);
            isTrue(i == 1);
            await db.unlisten('newChannel'); //To empty the queue
        }
    },
    {
        name: 'notification 11 - automatic notification restart...',
        fn: async (db: PgDb, isTrue: (value: boolean) => void) => {
            let i = 0;
            let fn1 = (notif: Notification) => { i += +notif.payload };
            await db.listen('newChannel', fn1);
            await postgresOff();
            await postgresOn();
            await asyncWaitMs(3000);
            let db2 = await PgDb.connect({});
            await db2.notify('newChannel', '1');
            await db2.close();
            await asyncWaitMs(1000);
            isTrue(i == 1);
            await db.unlisten('newChannel'); //To empty the queue
        }
    }
];

async function testParams() {
    console.log('Start testing params');

    let postgresOnCommandOk = true;
    let postgresOffCommandOk = false;
    let frameworkError = false;
    try {
        console.log('Postgres On test');
        await postgresOn();
        try {
            let db = await PgDb.connect({});
        } catch (e) {
            postgresOnCommandOk = false;
        }
        console.log('Postgres Off test');
        await postgresOff();
        try {
            let db = await PgDb.connect({});
        } catch (e) {
            postgresOffCommandOk = postgresOnCommandOk;
        }
        console.log('Postgres On test');
        await postgresOn();
        try {
            let db = await PgDb.connect({});
        } catch (e) {
            postgresOnCommandOk = false;
        }
    } catch (e) {
        console.log('Unknown exception has found', e);
        frameworkError = true;
    }
    if (!frameworkError) {
        if (postgresOffCommandOk && postgresOnCommandOk) {
            console.log('Postgres On/Off commands OK');
        } else {
            if (!postgresOnCommandOk) {
                console.log('Postgres On command NOT OK');
            }
            if (!postgresOffCommandOk) {
                console.log('Postgres Off command NOT OK');
            }
        }
    }
    console.log('Postgres On/Off test end');
}

async function runTests() {
    console.log('Start tests');

    let allTests = [
        ...newConnectionTests,
        ...dedicatedConnection_SimpleQueryTests,
        ...dedicatedConnection_StreamQueryTests,
        ...postgresRestartTests,
        ...notifyTests,
        ...postgresEndTests
    ];
    let testNamePrefix = '';
    try {
        if (testNamePrefix) {
            allTests = allTests.filter(v => v.name.startsWith(testNamePrefix));
        }
        for (let test of allTests) {
            await runTest(allTests.length, test);
        }

        console.log('All tests: ', actTestCounter);
        console.log(`Problematic tests: ${errorMessages.length}`);
        for (let errorMessage of errorMessages) {
            console.log(`Error in "${errorMessage.testName}"`);
            console.log(errorMessage.err);
        }
    } catch (e) {
        console.log('Error has found in the test framework!');
        console.log(e);
    }
    console.log('All tests are finished');
}

(async () => {
    if (!argv.postgresOn || !argv.postgresOff) {
        console.log('postgresOn or postgresOff parameter is missing!');
        return;
    }

    if (argv.testParams) {
        await testParams();
    } else {
        await runTests();
    }
})().catch(console.log);
