module.exports = async function (globalConfig, projectConfig) {
    console.log('db stopping...');
    globalThis.dbContainer?.stop();
    console.log('db stopped');
};

