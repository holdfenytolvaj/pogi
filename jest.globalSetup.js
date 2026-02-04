let { GenericContainer, Wait } = require("testcontainers");
module.exports = async function (globalConfig, projectConfig) {
    console.log('db starting...');
    try {
        globalThis.dbContainer = await new GenericContainer("postgres")
            .withEnvironment({
                POSTGRES_USER: process.env.PGUSER || 'postgres',
                POSTGRES_PASSWORD: process.env.PGPASSWORD || 'postgres',
            })
            .withExposedPorts({ container: 5432, host: +process.env.PGPORT || 5432 })
            .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections")) // it is a lie
            .start();
        await new Promise(r => setTimeout(r, 1000));
        console.log('db started');
    } catch (e) {
        console.error('db start failed', e);
    }
};