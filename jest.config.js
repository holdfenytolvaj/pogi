import 'dotenv/config';
//const { createDefaultEsmPreset } = require("ts-jest");
//import type { Config } from 'jest';
//import { createDefaultEsmPreset } from 'ts-jest';

// const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  rootDir: "./",
  modulePaths: [
    "<rootDir>"
  ],
  testMatch: [
    "**/*.test.ts"
  ],
  testEnvironment: "node",
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // transform: {
  //   ...createDefaultEsmPreset().transform,
  // },
  transform: {
    '^.+\\.tsx?$': '@swc/jest',
  },
  setupFilesAfterEnv: [
    "<rootDir>/jest.setup.ts",
  ],
  globalSetup: "<rootDir>jest.globalSetup.js",
  globalTeardown: "<rootDir>jest.globalTeardown.js",
};