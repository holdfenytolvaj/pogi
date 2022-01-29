// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    roots: ["./src"],
    testMatch: [
        "**/*.test.ts"
    ],
    testPathIgnorePatterns: ["/dist/", "/build/"],

    // A preset that is used as a base for Jest's configuration
    preset: "ts-jest",
    testEnvironment: "node",
    testRunner: "jest-jasmine2",

    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.json",
            isolatedModules: true
        }
    },
    setupFiles: ['dotenv/config']
};
