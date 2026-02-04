import { expect, jest, test } from '@jest/globals';
import inspector from 'inspector';
if (process.env.DEBUG || inspector.url()) {
    console.log('debugging jest, set some extra timeout');
    jest.setTimeout(5 * 60 * 1000);
}
// let { GenericContainer, Wait } = require("testcontainers");
// /** @type {import("testcontainers").StartedTestContainer} */
// let dbContainer;
// beforeAll(async () => {
//     console.log('db starting...');
//     dbContainer = await new GenericContainer("postgres:18")
//         .withExposedPorts({ container: 5432, host: 5432 })
//         // .withWaitStrategy(Wait.forListeningPorts())
//         .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
//         .start();
//     console.log('db started');
// });

// afterAll(async () => {
//     await dbContainer?.stop();
// });
